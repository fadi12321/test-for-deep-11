package datastore

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"sync/atomic"

	lru "github.com/hashicorp/golang-lru/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"gitlab.com/gitlab-org/gitaly/v15/internal/praefect/datastore/glsql"
)

// ConsistentStoragesGetter returns storages which contain the latest generation of a repository.
type ConsistentStoragesGetter interface {
	// GetConsistentStorages returns the replica path and the set of up to date storages for the given repository keyed by virtual storage and relative path.
	GetConsistentStorages(ctx context.Context, virtualStorage, relativePath string) (string, map[string]struct{}, error)
}

// errNotExistingVirtualStorage indicates that the requested virtual storage can't be found or not configured.
var errNotExistingVirtualStorage = errors.New("virtual storage does not exist")

// CachingConsistentStoragesGetter is a ConsistentStoragesGetter that caches up to date storages by repository.
// Each virtual storage has it's own cache that invalidates entries based on notifications.
type CachingConsistentStoragesGetter struct {
	csg ConsistentStoragesGetter
	// caches is per virtual storage cache. It is initialized once on construction.
	caches map[string]*lru.Cache[string, interface{}]
	// access is access method to use: 0 - without caching; 1 - with caching.
	access int32
	// syncer allows to sync retrieval operations to omit unnecessary runs.
	syncer syncer
	// callbackLogger should be used only inside of the methods used as callbacks.
	callbackLogger   logrus.FieldLogger
	cacheAccessTotal *prometheus.CounterVec
}

// NewCachingConsistentStoragesGetter returns a ConsistentStoragesGetter that uses caching.
func NewCachingConsistentStoragesGetter(logger logrus.FieldLogger, csg ConsistentStoragesGetter, virtualStorages []string) (*CachingConsistentStoragesGetter, error) {
	cached := &CachingConsistentStoragesGetter{
		csg:            csg,
		caches:         make(map[string]*lru.Cache[string, interface{}], len(virtualStorages)),
		syncer:         syncer{inflight: map[string]chan struct{}{}},
		callbackLogger: logger.WithField("component", "caching_storage_provider"),
		cacheAccessTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "gitaly_praefect_uptodate_storages_cache_access_total",
				Help: "Total number of cache access operations during defining of up to date storages for reads distribution (per virtual storage)",
			},
			[]string{"virtual_storage", "type"},
		),
	}

	for _, virtualStorage := range virtualStorages {
		virtualStorage := virtualStorage
		cache, err := lru.NewWithEvict(2<<20, func(key string, value interface{}) {
			cached.cacheAccessTotal.WithLabelValues(virtualStorage, "evict").Inc()
		})
		if err != nil {
			return nil, err
		}
		cached.caches[virtualStorage] = cache
	}

	return cached, nil
}

type notificationEntry struct {
	VirtualStorage string   `json:"virtual_storage"`
	RelativePaths  []string `json:"relative_paths"`
}

// Notification handles notifications by invalidating cache entries of updated repositories.
func (c *CachingConsistentStoragesGetter) Notification(n glsql.Notification) {
	var changes []notificationEntry
	if err := json.NewDecoder(strings.NewReader(n.Payload)).Decode(&changes); err != nil {
		c.disableCaching() // as we can't update cache properly we should disable it
		c.callbackLogger.WithError(err).WithField("channel", n.Channel).Error("received payload can't be processed, cache disabled")
		return
	}

	for _, entry := range changes {
		cache, found := c.getCache(entry.VirtualStorage)
		if !found {
			c.callbackLogger.WithError(errNotExistingVirtualStorage).WithField("virtual_storage", entry.VirtualStorage).Error("cache not found")
			continue
		}

		for _, relativePath := range entry.RelativePaths {
			cache.Remove(relativePath)
		}
	}
}

// Connected enables the cache when it has been connected to Postgres.
func (c *CachingConsistentStoragesGetter) Connected() {
	c.enableCaching() // (re-)enable cache usage
}

// Disconnect disables the caching when connection to Postgres has been lost.
func (c *CachingConsistentStoragesGetter) Disconnect(error) {
	// disable cache usage as it could be outdated
	c.disableCaching()
}

// Describe returns all metric descriptors.
func (c *CachingConsistentStoragesGetter) Describe(descs chan<- *prometheus.Desc) {
	prometheus.DescribeByCollect(c, descs)
}

// Collect collects all metrics.
func (c *CachingConsistentStoragesGetter) Collect(collector chan<- prometheus.Metric) {
	c.cacheAccessTotal.Collect(collector)
}

func (c *CachingConsistentStoragesGetter) enableCaching() {
	atomic.StoreInt32(&c.access, 1)
}

func (c *CachingConsistentStoragesGetter) disableCaching() {
	atomic.StoreInt32(&c.access, 0)

	for _, cache := range c.caches {
		cache.Purge()
	}
}

func (c *CachingConsistentStoragesGetter) getCache(virtualStorage string) (*lru.Cache[string, interface{}], bool) {
	val, found := c.caches[virtualStorage]
	return val, found
}

func (c *CachingConsistentStoragesGetter) cacheMiss(ctx context.Context, virtualStorage, relativePath string) (string, map[string]struct{}, error) {
	c.cacheAccessTotal.WithLabelValues(virtualStorage, "miss").Inc()
	return c.csg.GetConsistentStorages(ctx, virtualStorage, relativePath)
}

func (c *CachingConsistentStoragesGetter) tryCache(virtualStorage, relativePath string) (func(), *lru.Cache[string, interface{}], cacheValue, bool) {
	populateDone := func() {} // should be called AFTER any cache population is done

	cache, found := c.getCache(virtualStorage)
	if !found {
		return populateDone, nil, cacheValue{}, false
	}

	if storages, found := getKey(cache, relativePath); found {
		return populateDone, cache, storages, true
	}

	// synchronises concurrent attempts to update cache for the same key.
	populateDone = c.syncer.await(relativePath)

	if storages, found := getKey(cache, relativePath); found {
		return populateDone, cache, storages, true
	}

	return populateDone, cache, cacheValue{}, false
}

func (c *CachingConsistentStoragesGetter) isCacheEnabled() bool {
	return atomic.LoadInt32(&c.access) != 0
}

// GetConsistentStorages returns the replica path and the set of up to date storages for the given repository keyed by virtual storage and relative path.
func (c *CachingConsistentStoragesGetter) GetConsistentStorages(ctx context.Context, virtualStorage, relativePath string) (string, map[string]struct{}, error) {
	var cache *lru.Cache[string, interface{}]

	if c.isCacheEnabled() {
		var value cacheValue
		var ok bool
		var populationDone func()

		populationDone, cache, value, ok = c.tryCache(virtualStorage, relativePath)
		defer populationDone()
		if ok {
			c.cacheAccessTotal.WithLabelValues(virtualStorage, "hit").Inc()
			return value.replicaPath, value.storages, nil
		}
	}

	replicaPath, storages, err := c.cacheMiss(ctx, virtualStorage, relativePath)
	if err == nil && cache != nil {
		cache.Add(relativePath, cacheValue{replicaPath: replicaPath, storages: storages})
		c.cacheAccessTotal.WithLabelValues(virtualStorage, "populate").Inc()
	}
	return replicaPath, storages, err
}

type cacheValue struct {
	replicaPath string
	storages    map[string]struct{}
}

func getKey(cache *lru.Cache[string, interface{}], key string) (cacheValue, bool) {
	val, found := cache.Get(key)
	vals, _ := val.(cacheValue)
	return vals, found
}

// syncer allows to sync access to a particular key.
type syncer struct {
	// inflight contains set of keys already acquired for sync.
	inflight map[string]chan struct{}
	mtx      sync.Mutex
}

// await acquires lock for provided key and returns a callback to invoke once the key could be released.
// If key is already acquired the call will be blocked until callback for that key won't be called.
func (sc *syncer) await(key string) func() {
	sc.mtx.Lock()

	if cond, found := sc.inflight[key]; found {
		sc.mtx.Unlock()

		<-cond // the key is acquired, wait until it is released

		return func() {}
	}

	defer sc.mtx.Unlock()

	cond := make(chan struct{})
	sc.inflight[key] = cond

	return func() {
		sc.mtx.Lock()
		defer sc.mtx.Unlock()

		delete(sc.inflight, key)

		close(cond)
	}
}

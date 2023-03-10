package streamcache

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/gitaly/config"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/duration"
	"gitlab.com/gitlab-org/gitaly/v15/internal/helper/perm"
	"gitlab.com/gitlab-org/gitaly/v15/internal/log"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
)

func newCache(dir string) Cache {
	return New(config.StreamCacheConfig{
		Enabled: true,
		Dir:     dir,
		MaxAge:  duration.Duration(time.Hour),
	}, log.Default())
}

func TestCache_writeOneReadMultiple(t *testing.T) {
	ctx := testhelper.Context(t)

	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	const (
		key = "test key"
		N   = 10
	)
	content := func(i int) string { return fmt.Sprintf("content %d", i) }

	for i := 0; i < N; i++ {
		t.Run(fmt.Sprintf("read %d", i), func(t *testing.T) {
			r, created, err := c.FindOrCreate(key, writeString(content(i)))
			require.NoError(t, err)
			defer r.Close()

			require.Equal(t, i == 0, created, "all calls except the first one should be cache hits")

			out, err := io.ReadAll(r)
			require.NoError(t, err)
			require.NoError(t, r.Wait(ctx))
			require.Equal(t, content(0), string(out), "expect cache hits for all i > 0")
		})
	}

	requireCacheFiles(t, tmp, 1)
}

func TestCache_manyConcurrentWrites(t *testing.T) {
	ctx := testhelper.Context(t)

	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	const (
		key = "test key"
		N   = 1000
	)
	content := make([]string, N)
	errors := make(chan error, N)
	output := make([]string, N)
	start := make(chan struct{})
	buf := make([]byte, 4096)

	for i := 0; i < N; i++ {
		_, _ = rand.Read(buf) // math/rand.Read always returns len(buf), nil
		content[i] = string(buf)

		go func(i int) {
			errors <- func() error {
				<-start

				r, _, err := c.FindOrCreate(key, writeString(content[i]))
				if err != nil {
					return err
				}
				defer r.Close()

				out, err := io.ReadAll(r)
				if err != nil {
					return err
				}
				output[i] = string(out)

				return r.Wait(ctx)
			}()
		}(i)
	}

	close(start) // Start all goroutines at once

	// Wait for all goroutines to finish
	for i := 0; i < N; i++ {
		require.NoError(t, <-errors)
	}

	for i := 0; i < N; i++ {
		require.Equal(t, output[0], output[i], "all calls to FindOrCreate returned the same bytes")
	}

	require.Contains(t, content, output[0], "data returned by FindOrCreate is not mangled")

	requireCacheFiles(t, tmp, 1)
}

func writeString(s string) func(io.Writer) error {
	return func(w io.Writer) error {
		_, err := io.WriteString(w, s)
		return err
	}
}

func requireCacheFiles(t *testing.T, dir string, n int) {
	t.Helper()

	find := string(testhelper.MustRunCommand(t, nil, "find", dir, "-type", "f"))
	require.Equal(t, n, strings.Count(find, "\n"), "unexpected find output %q", find)
}

func requireCacheEntries(t *testing.T, _c Cache, n int) {
	t.Helper()
	c := _c.(*cache)
	c.m.Lock()
	defer c.m.Unlock()
	require.Len(t, c.index, n)
}

func TestCache_deletedFile(t *testing.T) {
	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	const (
		key = "test key"
	)
	content := func(i int) string { return fmt.Sprintf("content %d", i) }

	r1, created, err := c.FindOrCreate(key, writeString(content(1)))
	require.NoError(t, err)
	defer r1.Close()
	require.True(t, created)

	require.NoError(t, os.RemoveAll(tmp), "wipe out underlying files of cache")
	require.NoError(t, os.MkdirAll(tmp, perm.SharedDir))

	// File is gone from filesystem but not from cache
	requireCacheFiles(t, tmp, 0)
	requireCacheEntries(t, c, 1)

	r2, created, err := c.FindOrCreate(key, writeString(content(2)))
	require.NoError(t, err)
	defer r2.Close()
	require.True(t, created, "because the first file is gone, cache is forced to create a new entry")

	out1, err := io.ReadAll(r1)
	require.NoError(t, err)
	require.Equal(t, content(1), string(out1), "r1 should still see its original pre-wipe contents")

	out2, err := io.ReadAll(r2)
	require.NoError(t, err)
	require.Equal(t, content(2), string(out2), "r2 should see the new post-wipe contents")
}

func TestCache_scope(t *testing.T) {
	ctx := testhelper.Context(t)

	tmp := testhelper.TempDir(t)

	const (
		N   = 100
		key = "test key"
	)

	// Intentionally create multiple cache instances sharing one directory,
	// to test that they do not trample on each others files.
	cache := make([]Cache, N)
	input := make([]string, N)
	reader := make([]*Stream, N)
	var err error

	for i := 0; i < N; i++ {
		input[i] = fmt.Sprintf("test content %d", i)
		cache[i] = newCache(tmp)
		defer func(i int) { cache[i].Stop() }(i)

		var created bool
		reader[i], created, err = cache[i].FindOrCreate(key, writeString(input[i]))
		require.NoError(t, err)
		defer func(i int) { require.NoError(t, reader[i].Close()) }(i)
		require.True(t, created)
	}

	// If different cache instances overwrite their entries, the effect may
	// be order dependent, e.g. "last write wins". We could reverse the order
	// now to catch that possible bug, but then we only test for one kind of
	// bug. Let's shuffle instead, which can catch more hypothetical bugs.
	rand.Shuffle(N, func(i, j int) {
		reader[i], reader[j] = reader[j], reader[i]
		input[i], input[j] = input[j], input[i]
	})

	for i := 0; i < N; i++ {
		r, content := reader[i], input[i]

		out, err := io.ReadAll(r)
		require.NoError(t, err)
		require.NoError(t, r.Wait(ctx))

		require.Equal(t, content, string(out))
	}
}

func TestCache_diskCleanup(t *testing.T) {
	ctx := testhelper.Context(t)

	tmp := testhelper.TempDir(t)

	const (
		key = "test key"
	)

	filestoreCleanTimerCh := make(chan time.Time)
	filestoreClean := func(time.Duration) <-chan time.Time {
		return filestoreCleanTimerCh
	}

	cleanSleepTimerCh := make(chan time.Time)
	cleanSleep := func(time.Duration) <-chan time.Time {
		return cleanSleepTimerCh
	}

	c := newCacheWithSleep(tmp, 0, filestoreClean, cleanSleep, log.Default())
	defer c.Stop()

	var removalLock sync.Mutex
	c.removalCond = sync.NewCond(&removalLock)

	content := func(i int) string { return fmt.Sprintf("content %d", i) }

	r1, created, err := c.FindOrCreate(key, writeString(content(1)))
	require.NoError(t, err)
	defer r1.Close()
	require.True(t, created)

	out1, err := io.ReadAll(r1)
	require.NoError(t, err)
	require.Equal(t, content(1), string(out1))
	require.NoError(t, r1.Wait(ctx))

	// File and index entry should still exist because cleanup goroutines are blocked.
	requireCacheFiles(t, tmp, 1)
	requireCacheEntries(t, c, 1)

	// In order to avoid having to sleep, we instead use the removalCond of the cache. Like
	// this, we can lock the condition before scheduling removal of the cache entry and then
	// wait for the condition to be triggered. Like this, we can wait for removal in an entirely
	// race-free manner.
	removedCh := make(chan struct{})
	removalLock.Lock()
	go func() {
		defer func() {
			removalLock.Unlock()
			close(removedCh)
		}()

		c.removalCond.Wait()
	}()

	// Unblock cleanup goroutines so they run exactly once
	cleanSleepTimerCh <- time.Time{}
	filestoreCleanTimerCh <- time.Time{}

	<-removedCh

	// File and index entry should have been removed by cleanup goroutines.
	requireCacheFiles(t, tmp, 0)
	requireCacheEntries(t, c, 0)

	r2, created, err := c.FindOrCreate(key, writeString(content(2)))
	require.NoError(t, err)
	defer r2.Close()
	require.True(t, created)

	out2, err := io.ReadAll(r2)
	require.NoError(t, err)
	require.NoError(t, r2.Wait(ctx))

	// Sanity check: no stale value returned by the cache
	require.Equal(t, content(2), string(out2))
}

func TestCache_failedWrite(t *testing.T) {
	ctx := testhelper.Context(t)

	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	testCases := []struct {
		desc   string
		create func(io.Writer) error
	}{
		{
			desc:   "create returns error",
			create: func(io.Writer) error { return errors.New("something went wrong") },
		},
		{
			desc:   "create panics",
			create: func(io.Writer) error { panic("oh no") },
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			r1, created, err := c.FindOrCreate(tc.desc, tc.create)
			require.NoError(t, err)
			require.True(t, created)

			_, err = io.Copy(io.Discard, r1)
			require.NoError(t, err, "errors on the write end are not propagated via Read()")
			require.NoError(t, r1.Close(), "errors on the write end are not propagated via Close()")
			require.Error(t, r1.Wait(ctx), "error propagation happens via Wait()")

			const happy = "all is good"
			r2, created, err := c.FindOrCreate(tc.desc, writeString(happy))
			require.NoError(t, err)
			defer r2.Close()
			require.True(t, created, "because the previous entry failed, a new one should have been created")

			out, err := io.ReadAll(r2)
			require.NoError(t, err)
			require.NoError(t, r2.Wait(ctx))
			require.Equal(t, happy, string(out))
		})
	}
}

func TestCache_failCreateFile(t *testing.T) {
	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	createError := errors.New("cannot create file")
	c.(*cache).createFile = func() (namedWriteCloser, error) { return nil, createError }

	_, _, err := c.FindOrCreate("key", func(io.Writer) error { return nil })
	require.Equal(t, createError, err)
}

func TestCache_unWriteableFile(t *testing.T) {
	ctx := testhelper.Context(t)

	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	c.(*cache).createFile = func() (namedWriteCloser, error) {
		return os.OpenFile(filepath.Join(tmp, "unwriteable"), os.O_RDONLY|os.O_CREATE|os.O_EXCL, perm.SharedFile)
	}

	r, created, err := c.FindOrCreate("key", func(w io.Writer) error {
		_, err := io.WriteString(w, "hello")
		return err
	})
	require.NoError(t, err)
	require.True(t, created)

	_, err = io.ReadAll(r)
	require.NoError(t, err)

	err = r.Wait(ctx)
	require.IsType(t, &os.PathError{}, err)
	require.Equal(t, "write", err.(*os.PathError).Op)
}

func TestCache_unCloseableFile(t *testing.T) {
	ctx := testhelper.Context(t)

	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	c.(*cache).createFile = func() (namedWriteCloser, error) {
		f, err := os.OpenFile(filepath.Join(tmp, "uncloseable"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm.SharedFile)
		if err != nil {
			return nil, err
		}
		return f, f.Close() // Already closed so cannot be closed again
	}

	r, created, err := c.FindOrCreate("key", func(w io.Writer) error { return nil })
	require.NoError(t, err)
	require.True(t, created)

	_, err = io.ReadAll(r)
	require.NoError(t, err)

	err = r.Wait(ctx)
	require.IsType(t, &os.PathError{}, err)
	require.Equal(t, "close", err.(*os.PathError).Op)
}

func TestCache_cannotOpenFileForReading(t *testing.T) {
	tmp := testhelper.TempDir(t)

	c := newCache(tmp)
	defer c.Stop()

	c.(*cache).createFile = func() (namedWriteCloser, error) {
		f, err := os.OpenFile(filepath.Join(tmp, "unopenable"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm.SharedFile)
		if err != nil {
			return nil, err
		}
		return f, os.Remove(f.Name()) // Removed so cannot be opened
	}

	_, _, err := c.FindOrCreate("key", func(w io.Writer) error { return nil })
	err = errors.Unwrap(err)
	require.IsType(t, &os.PathError{}, err)
	require.Equal(t, "open", err.(*os.PathError).Op)
}

func TestWaiter(t *testing.T) {
	ctx := testhelper.Context(t)

	w := newWaiter()
	err := errors.New("test error")
	w.SetError(err)
	require.Equal(t, err, w.Wait(ctx))
}

func TestWaiter_cancel(t *testing.T) {
	ctx, cancel := context.WithCancel(testhelper.Context(t))

	w := newWaiter()
	errc := make(chan error, 1)
	go func() { errc <- w.Wait(ctx) }()

	cancel()
	require.Equal(t, context.Canceled, <-errc)
}

func TestNullCache(t *testing.T) {
	ctx := testhelper.Context(t)

	const (
		N         = 1000
		inputSize = 4096
		key       = "key"
	)

	c := NullCache{}
	start := make(chan struct{})
	results := make(chan error, N)

	for i := 0; i < N; i++ {
		go func() {
			results <- func() error {
				input := make([]byte, inputSize)
				n, err := rand.Read(input)
				if err != nil {
					return err
				}
				if n != inputSize {
					return io.ErrShortWrite
				}

				<-start

				s, created, err := c.FindOrCreate(key, func(w io.Writer) error {
					for j := 0; j < len(input); j++ {
						n, err := w.Write(input[j : j+1])
						if err != nil {
							return err
						}
						if n != 1 {
							return io.ErrShortWrite
						}
					}
					return nil
				})
				if err != nil {
					return err
				}
				defer s.Close()

				if !created {
					return errors.New("created should be true")
				}

				output, err := io.ReadAll(s)
				if err != nil {
					return err
				}
				if !bytes.Equal(output, input) {
					return errors.New("output does not match input")
				}

				return s.Wait(ctx)
			}()
		}()
	}

	close(start)
	for i := 0; i < N; i++ {
		require.NoError(t, <-results)
	}
}

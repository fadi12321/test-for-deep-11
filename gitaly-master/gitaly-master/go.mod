module gitlab.com/gitlab-org/gitaly/v15

go 1.18

// It is a temporary solution, please see https://gitlab.com/gitlab-org/gitaly/-/issues/4423 for details.
replace github.com/go-enry/go-license-detector/v4 => github.com/gl-gitaly/go-license-detector/v4 v4.0.0-20230217131025-5f34a24251ba

require (
	github.com/ProtonMail/go-crypto v0.0.0-20230217124315-7d5c6f04bbb8
	github.com/beevik/ntp v0.3.0
	github.com/cloudflare/tableflip v1.2.3
	github.com/containerd/cgroups v1.1.0
	github.com/dgraph-io/badger/v3 v3.2103.5
	github.com/getsentry/sentry-go v0.18.0
	github.com/git-lfs/git-lfs/v3 v3.3.0
	github.com/go-enry/go-enry/v2 v2.8.3
	github.com/go-enry/go-license-detector/v4 v4.3.0
	github.com/golang-jwt/jwt/v4 v4.5.0
	github.com/google/go-cmp v0.5.9
	github.com/google/uuid v1.3.0
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.0
	github.com/hashicorp/golang-lru/v2 v2.0.1
	github.com/hashicorp/yamux v0.1.1
	github.com/jackc/pgconn v1.14.0
	github.com/jackc/pgtype v1.14.0
	github.com/jackc/pgx/v4 v4.18.0
	github.com/kelseyhightower/envconfig v1.4.0
	github.com/libgit2/git2go/v34 v34.0.0
	github.com/miekg/dns v1.1.50
	github.com/olekukonko/tablewriter v0.0.5
	github.com/opencontainers/runtime-spec v1.0.3-0.20210326190908-1c3f411f0417
	github.com/opentracing/opentracing-go v1.2.0
	github.com/pelletier/go-toml/v2 v2.0.6
	github.com/prometheus/client_golang v1.14.0
	github.com/prometheus/client_model v0.3.0
	github.com/rubenv/sql-migrate v1.3.1
	github.com/sirupsen/logrus v1.9.0
	github.com/stretchr/testify v1.8.1
	github.com/uber/jaeger-client-go v2.30.0+incompatible
	gitlab.com/gitlab-org/labkit v1.17.0
	go.uber.org/goleak v1.2.1
	gocloud.dev v0.28.0
	golang.org/x/exp v0.0.0-20230224173230-c95f2b4c22f2
	golang.org/x/sync v0.1.0
	golang.org/x/sys v0.5.0
	golang.org/x/time v0.3.0
	google.golang.org/grpc v1.53.0
	google.golang.org/protobuf v1.28.1
)

require (
	cloud.google.com/go v0.107.0 // indirect
	cloud.google.com/go/compute v1.15.1 // indirect
	cloud.google.com/go/compute/metadata v0.2.3 // indirect
	cloud.google.com/go/iam v0.8.0 // indirect
	cloud.google.com/go/monitoring v1.9.0 // indirect
	cloud.google.com/go/profiler v0.1.0 // indirect
	cloud.google.com/go/storage v1.28.0 // indirect
	cloud.google.com/go/trace v1.4.0 // indirect
	contrib.go.opencensus.io/exporter/stackdriver v0.13.14 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.2.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.2.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/internal v1.1.2 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/storage/azblob v0.6.1 // indirect
	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
	github.com/Azure/go-autorest/autorest/to v0.4.0 // indirect
	github.com/AzureAD/microsoft-authentication-library-for-go v0.7.0 // indirect
	github.com/DataDog/datadog-go v4.4.0+incompatible // indirect
	github.com/DataDog/sketches-go v1.0.0 // indirect
	github.com/Microsoft/go-winio v0.6.0 // indirect
	github.com/StackExchange/wmi v0.0.0-20190523213315-cbe66965904d // indirect
	github.com/acomagu/bufpipe v1.0.3 // indirect
	github.com/alexbrainman/sspi v0.0.0-20210105120005-909beea2cc74 // indirect
	github.com/avast/retry-go v3.0.0+incompatible // indirect
	github.com/aws/aws-sdk-go v1.44.151 // indirect
	github.com/aws/aws-sdk-go-v2 v1.17.1 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.4.9 // indirect
	github.com/aws/aws-sdk-go-v2/config v1.18.3 // indirect
	github.com/aws/aws-sdk-go-v2/credentials v1.13.3 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.12.19 // indirect
	github.com/aws/aws-sdk-go-v2/feature/s3/manager v1.11.42 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.1.25 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.4.19 // indirect
	github.com/aws/aws-sdk-go-v2/internal/ini v1.3.26 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.0.16 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.9.10 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.1.20 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.9.19 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.13.19 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.29.4 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.11.25 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.13.8 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.17.5 // indirect
	github.com/aws/smithy-go v1.13.4 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/census-instrumentation/opencensus-proto v0.4.1 // indirect
	github.com/cespare/xxhash v1.1.0 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/client9/reopen v1.0.0 // indirect
	github.com/cloudflare/circl v1.2.0 // indirect
	github.com/coreos/go-systemd/v22 v22.5.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/dgraph-io/ristretto v0.1.1 // indirect
	github.com/dgryski/go-minhash v0.0.0-20190315135803-ad340ca03076 // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/dpotapov/go-spnego v0.0.0-20220426193508-b7f82e4507db // indirect
	github.com/dustin/go-humanize v1.0.0 // indirect
	github.com/ekzhu/minhash-lsh v0.0.0-20190924033628-faac2c6342f8 // indirect
	github.com/emirpasic/gods v1.18.1 // indirect
	github.com/git-lfs/gitobj/v2 v2.1.1 // indirect
	github.com/git-lfs/go-netrc v0.0.0-20210914205454-f0c862dd687a // indirect
	github.com/git-lfs/pktline v0.0.0-20210330133718-06e9096e2825 // indirect
	github.com/git-lfs/wildmatch/v2 v2.0.1 // indirect
	github.com/go-enry/go-oniguruma v1.2.1 // indirect
	github.com/go-git/gcfg v1.5.0 // indirect
	github.com/go-git/go-billy/v5 v5.3.1 // indirect
	github.com/go-git/go-git/v5 v5.4.2 // indirect
	github.com/go-gorp/gorp/v3 v3.0.5 // indirect
	github.com/go-ole/go-ole v1.2.4 // indirect
	github.com/godbus/dbus/v5 v5.0.6 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/glog v1.0.0 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/golang/snappy v0.0.4 // indirect
	github.com/google/flatbuffers v1.12.1 // indirect
	github.com/google/pprof v0.0.0-20221102093814-76f304f74e5e // indirect
	github.com/google/wire v0.5.0 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.2.0 // indirect
	github.com/googleapis/gax-go/v2 v2.7.0 // indirect
	github.com/hashicorp/go-uuid v1.0.3 // indirect
	github.com/hhatto/gorst v0.0.0-20181029133204-ca9f730cac5b // indirect
	github.com/imdario/mergo v0.3.13 // indirect
	github.com/jackc/chunkreader/v2 v2.0.1 // indirect
	github.com/jackc/pgio v1.0.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgproto3/v2 v2.3.2 // indirect
	github.com/jackc/pgservicefile v0.0.0-20221227161230-091c0ba34f0a // indirect
	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
	github.com/jcmturner/aescts/v2 v2.0.0 // indirect
	github.com/jcmturner/dnsutils/v2 v2.0.0 // indirect
	github.com/jcmturner/gofork v1.0.0 // indirect
	github.com/jcmturner/goidentity/v6 v6.0.1 // indirect
	github.com/jcmturner/gokrb5/v8 v8.4.2 // indirect
	github.com/jcmturner/rpc/v2 v2.0.3 // indirect
	github.com/jdkato/prose v1.2.1 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/kevinburke/ssh_config v1.2.0 // indirect
	github.com/klauspost/compress v1.15.11 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/leonelquinteros/gotext v1.5.0 // indirect
	github.com/lightstep/lightstep-tracer-common/golang/gogo v0.0.0-20210210170715-a8dfcb80d3a7 // indirect
	github.com/lightstep/lightstep-tracer-go v0.25.0 // indirect
	github.com/mattn/go-isatty v0.0.17 // indirect
	github.com/mattn/go-runewidth v0.0.9 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.2-0.20181231171920-c182affec369 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/montanaflynn/stats v0.6.6 // indirect
	github.com/oklog/ulid/v2 v2.0.2 // indirect
	github.com/olekukonko/ts v0.0.0-20171002115256-78ecb04241c0 // indirect
	github.com/philhofer/fwd v1.1.1 // indirect
	github.com/pkg/browser v0.0.0-20210911075715-681adbf594b8 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/common v0.37.0 // indirect
	github.com/prometheus/procfs v0.8.0 // indirect
	github.com/prometheus/prometheus v0.40.5 // indirect
	github.com/rubyist/tracerx v0.0.0-20170927163412-787959303086 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/sebest/xff v0.0.0-20210106013422-671bd2870b3a // indirect
	github.com/sergi/go-diff v1.2.0 // indirect
	github.com/shirou/gopsutil/v3 v3.21.2 // indirect
	github.com/shogo82148/go-shuffle v1.0.1 // indirect
	github.com/ssgelm/cookiejarparser v1.0.1 // indirect
	github.com/tinylib/msgp v1.1.2 // indirect
	github.com/tklauser/go-sysconf v0.3.4 // indirect
	github.com/tklauser/numcpus v0.2.1 // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/xanzy/ssh-agent v0.3.2 // indirect
	go.opencensus.io v0.24.0 // indirect
	go.uber.org/atomic v1.10.0 // indirect
	golang.org/x/crypto v0.6.0 // indirect
	golang.org/x/mod v0.7.0 // indirect
	golang.org/x/net v0.6.0 // indirect
	golang.org/x/oauth2 v0.4.0 // indirect
	golang.org/x/text v0.7.0 // indirect
	golang.org/x/tools v0.5.0 // indirect
	golang.org/x/xerrors v0.0.0-20220907171357-04be3eba64a2 // indirect
	gonum.org/v1/gonum v0.8.2 // indirect
	google.golang.org/api v0.103.0 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/genproto v0.0.0-20230110181048-76db0878b65f // indirect
	gopkg.in/DataDog/dd-trace-go.v1 v1.32.0 // indirect
	gopkg.in/neurosnap/sentences.v1 v1.0.7 // indirect
	gopkg.in/warnings.v0 v0.1.2 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

exclude (
	// CVE-2020-28483
	github.com/gin-gonic/gin v1.4.0
	github.com/gin-gonic/gin v1.6.3
)

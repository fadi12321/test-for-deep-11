package metadatahandler

import (
	"context"
	"fmt"
	"testing"
	"time"

	grpcmwtags "github.com/grpc-ecosystem/go-grpc-middleware/tags"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gitlab.com/gitlab-org/gitaly/v15/internal/testhelper"
	"gitlab.com/gitlab-org/labkit/correlation"
	"google.golang.org/grpc/metadata"
)

const (
	correlationID = "CORRELATION_ID"
	clientName    = "CLIENT_NAME"
)

func TestAddMetadataTags(t *testing.T) {
	baseContext := testhelper.Context(t)

	testCases := []struct {
		desc             string
		metadata         metadata.MD
		deadline         bool
		expectedMetatags metadataTags
	}{
		{
			desc:     "empty metadata",
			metadata: metadata.Pairs(),
			deadline: false,
			expectedMetatags: metadataTags{
				clientName:   unknownValue,
				callSite:     unknownValue,
				authVersion:  unknownValue,
				deadlineType: "none",
			},
		},
		{
			desc:     "context containing metadata",
			metadata: metadata.Pairs("call_site", "testsite"),
			deadline: false,
			expectedMetatags: metadataTags{
				clientName:   unknownValue,
				callSite:     "testsite",
				authVersion:  unknownValue,
				deadlineType: "none",
			},
		},
		{
			desc:     "context containing metadata and a deadline",
			metadata: metadata.Pairs("call_site", "testsite"),
			deadline: true,
			expectedMetatags: metadataTags{
				clientName:   unknownValue,
				callSite:     "testsite",
				authVersion:  unknownValue,
				deadlineType: unknownValue,
			},
		},
		{
			desc:     "context containing metadata and a deadline type",
			metadata: metadata.Pairs("deadline_type", "regular"),
			deadline: true,
			expectedMetatags: metadataTags{
				clientName:   unknownValue,
				callSite:     unknownValue,
				authVersion:  unknownValue,
				deadlineType: "regular",
			},
		},
		{
			desc:     "a context without deadline but with deadline type",
			metadata: metadata.Pairs("deadline_type", "regular"),
			deadline: false,
			expectedMetatags: metadataTags{
				clientName:   unknownValue,
				callSite:     unknownValue,
				authVersion:  unknownValue,
				deadlineType: "none",
			},
		},
		{
			desc:     "with a context containing metadata",
			metadata: metadata.Pairs("deadline_type", "regular", "client_name", "rails"),
			deadline: true,
			expectedMetatags: metadataTags{
				clientName:   "rails",
				callSite:     unknownValue,
				authVersion:  unknownValue,
				deadlineType: "regular",
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.desc, func(t *testing.T) {
			ctx := metadata.NewIncomingContext(baseContext, testCase.metadata)
			if testCase.deadline {
				var cancel func()
				//nolint:forbidigo // We explicitly need to test whether deadlines
				// propagate as expected.
				ctx, cancel = context.WithDeadline(ctx, time.Now().Add(50*time.Millisecond))
				defer cancel()
			}
			require.Equal(t, testCase.expectedMetatags, addMetadataTags(ctx, "unary"))
		})
	}
}

func verifyHandler(ctx context.Context, req interface{}) (interface{}, error) {
	require, ok := req.(*require.Assertions)
	if !ok {
		return nil, fmt.Errorf("unexpected type conversion failure")
	}
	metaTags := addMetadataTags(ctx, "unary")
	require.Equal(clientName, metaTags.clientName)

	tags := grpcmwtags.Extract(ctx)
	require.True(tags.Has(CorrelationIDKey))
	require.True(tags.Has(ClientNameKey))
	values := tags.Values()
	require.Equal(correlationID, values[CorrelationIDKey])
	require.Equal(clientName, values[ClientNameKey])

	return nil, nil
}

func TestGRPCTags(t *testing.T) {
	ctx := testhelper.Context(t)

	require := require.New(t)

	ctx = metadata.NewIncomingContext(
		correlation.ContextWithCorrelation(
			correlation.ContextWithClientName(
				ctx,
				clientName,
			),
			correlationID,
		),
		metadata.Pairs(),
	)

	interceptor := grpcmwtags.UnaryServerInterceptor()

	_, err := interceptor(ctx, require, nil, verifyHandler)
	require.NoError(err)
}

func Test_extractServiceName(t *testing.T) {
	tests := []struct {
		name                    string
		fullMethodName          string
		wantService, wantMethod string
	}{
		{
			name:           "blank",
			fullMethodName: "",
			wantService:    unknownValue,
			wantMethod:     unknownValue,
		},
		{
			name:           "normal",
			fullMethodName: "/gitaly.OperationService/method",
			wantService:    "gitaly.OperationService",
			wantMethod:     "method",
		},
		{
			name:           "malformed",
			fullMethodName: "//method",
			wantService:    "",
			wantMethod:     "method",
		},
		{
			name:           "malformed",
			fullMethodName: "/gitaly.OperationService/",
			wantService:    "gitaly.OperationService",
			wantMethod:     "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotService, gotMethod := extractServiceAndMethodName(tt.fullMethodName)
			assert.Equal(t, tt.wantService, gotService)
			assert.Equal(t, tt.wantMethod, gotMethod)
		})
	}
}

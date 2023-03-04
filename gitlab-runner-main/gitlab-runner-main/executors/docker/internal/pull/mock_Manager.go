// Code generated by mockery v2.14.0. DO NOT EDIT.

package pull

import (
	mock "github.com/stretchr/testify/mock"
	common "gitlab.com/gitlab-org/gitlab-runner/common"

	types "github.com/docker/docker/api/types"
)

// MockManager is an autogenerated mock type for the Manager type
type MockManager struct {
	mock.Mock
}

// GetDockerImage provides a mock function with given fields: imageName, imagePullPolicies
func (_m *MockManager) GetDockerImage(imageName string, imagePullPolicies []common.DockerPullPolicy) (*types.ImageInspect, error) {
	ret := _m.Called(imageName, imagePullPolicies)

	var r0 *types.ImageInspect
	if rf, ok := ret.Get(0).(func(string, []common.DockerPullPolicy) *types.ImageInspect); ok {
		r0 = rf(imageName, imagePullPolicies)
	} else {
		if ret.Get(0) != nil {
			r0 = ret.Get(0).(*types.ImageInspect)
		}
	}

	var r1 error
	if rf, ok := ret.Get(1).(func(string, []common.DockerPullPolicy) error); ok {
		r1 = rf(imageName, imagePullPolicies)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}

type mockConstructorTestingTNewMockManager interface {
	mock.TestingT
	Cleanup(func())
}

// NewMockManager creates a new instance of MockManager. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
func NewMockManager(t mockConstructorTestingTNewMockManager) *MockManager {
	mock := &MockManager{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}
// Code generated by mockery v2.14.0. DO NOT EDIT.

package volumes

import (
	context "context"

	mock "github.com/stretchr/testify/mock"
)

// MockManager is an autogenerated mock type for the Manager type
type MockManager struct {
	mock.Mock
}

// Binds provides a mock function with given fields:
func (_m *MockManager) Binds() []string {
	ret := _m.Called()

	var r0 []string
	if rf, ok := ret.Get(0).(func() []string); ok {
		r0 = rf()
	} else {
		if ret.Get(0) != nil {
			r0 = ret.Get(0).([]string)
		}
	}

	return r0
}

// Create provides a mock function with given fields: ctx, volume
func (_m *MockManager) Create(ctx context.Context, volume string) error {
	ret := _m.Called(ctx, volume)

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context, string) error); ok {
		r0 = rf(ctx, volume)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// CreateTemporary provides a mock function with given fields: ctx, destination
func (_m *MockManager) CreateTemporary(ctx context.Context, destination string) error {
	ret := _m.Called(ctx, destination)

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context, string) error); ok {
		r0 = rf(ctx, destination)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// RemoveTemporary provides a mock function with given fields: ctx
func (_m *MockManager) RemoveTemporary(ctx context.Context) error {
	ret := _m.Called(ctx)

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context) error); ok {
		r0 = rf(ctx)
	} else {
		r0 = ret.Error(0)
	}

	return r0
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

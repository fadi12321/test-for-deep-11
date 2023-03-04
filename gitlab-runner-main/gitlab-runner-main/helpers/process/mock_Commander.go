// Code generated by mockery v2.14.0. DO NOT EDIT.

package process

import (
	os "os"

	mock "github.com/stretchr/testify/mock"
)

// MockCommander is an autogenerated mock type for the Commander type
type MockCommander struct {
	mock.Mock
}

// Process provides a mock function with given fields:
func (_m *MockCommander) Process() *os.Process {
	ret := _m.Called()

	var r0 *os.Process
	if rf, ok := ret.Get(0).(func() *os.Process); ok {
		r0 = rf()
	} else {
		if ret.Get(0) != nil {
			r0 = ret.Get(0).(*os.Process)
		}
	}

	return r0
}

// Start provides a mock function with given fields:
func (_m *MockCommander) Start() error {
	ret := _m.Called()

	var r0 error
	if rf, ok := ret.Get(0).(func() error); ok {
		r0 = rf()
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// Wait provides a mock function with given fields:
func (_m *MockCommander) Wait() error {
	ret := _m.Called()

	var r0 error
	if rf, ok := ret.Get(0).(func() error); ok {
		r0 = rf()
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

type mockConstructorTestingTNewMockCommander interface {
	mock.TestingT
	Cleanup(func())
}

// NewMockCommander creates a new instance of MockCommander. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
func NewMockCommander(t mockConstructorTestingTNewMockCommander) *MockCommander {
	mock := &MockCommander{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

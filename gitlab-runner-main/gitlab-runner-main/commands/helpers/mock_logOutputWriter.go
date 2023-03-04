// Code generated by mockery v2.14.0. DO NOT EDIT.

package helpers

import mock "github.com/stretchr/testify/mock"

// mockLogOutputWriter is an autogenerated mock type for the logOutputWriter type
type mockLogOutputWriter struct {
	mock.Mock
}

// Write provides a mock function with given fields: _a0
func (_m *mockLogOutputWriter) Write(_a0 string) {
	_m.Called(_a0)
}

type mockConstructorTestingTnewMockLogOutputWriter interface {
	mock.TestingT
	Cleanup(func())
}

// newMockLogOutputWriter creates a new instance of mockLogOutputWriter. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
func newMockLogOutputWriter(t mockConstructorTestingTnewMockLogOutputWriter) *mockLogOutputWriter {
	mock := &mockLogOutputWriter{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}
// Code generated by mockery v2.14.0. DO NOT EDIT.

package shells

import (
	mock "github.com/stretchr/testify/mock"
	common "gitlab.com/gitlab-org/gitlab-runner/common"
)

// MockShellWriter is an autogenerated mock type for the ShellWriter type
type MockShellWriter struct {
	mock.Mock
}

// Absolute provides a mock function with given fields: path
func (_m *MockShellWriter) Absolute(path string) string {
	ret := _m.Called(path)

	var r0 string
	if rf, ok := ret.Get(0).(func(string) string); ok {
		r0 = rf(path)
	} else {
		r0 = ret.Get(0).(string)
	}

	return r0
}

// Cd provides a mock function with given fields: path
func (_m *MockShellWriter) Cd(path string) {
	_m.Called(path)
}

// CheckForErrors provides a mock function with given fields:
func (_m *MockShellWriter) CheckForErrors() {
	_m.Called()
}

// Command provides a mock function with given fields: command, arguments
func (_m *MockShellWriter) Command(command string, arguments ...string) {
	_va := make([]interface{}, len(arguments))
	for _i := range arguments {
		_va[_i] = arguments[_i]
	}
	var _ca []interface{}
	_ca = append(_ca, command)
	_ca = append(_ca, _va...)
	_m.Called(_ca...)
}

// CommandArgExpand provides a mock function with given fields: command, arguments
func (_m *MockShellWriter) CommandArgExpand(command string, arguments ...string) {
	_va := make([]interface{}, len(arguments))
	for _i := range arguments {
		_va[_i] = arguments[_i]
	}
	var _ca []interface{}
	_ca = append(_ca, command)
	_ca = append(_ca, _va...)
	_m.Called(_ca...)
}

// Else provides a mock function with given fields:
func (_m *MockShellWriter) Else() {
	_m.Called()
}

// EmptyLine provides a mock function with given fields:
func (_m *MockShellWriter) EmptyLine() {
	_m.Called()
}

// EndIf provides a mock function with given fields:
func (_m *MockShellWriter) EndIf() {
	_m.Called()
}

// EnvVariableKey provides a mock function with given fields: name
func (_m *MockShellWriter) EnvVariableKey(name string) string {
	ret := _m.Called(name)

	var r0 string
	if rf, ok := ret.Get(0).(func(string) string); ok {
		r0 = rf(name)
	} else {
		r0 = ret.Get(0).(string)
	}

	return r0
}

// Errorf provides a mock function with given fields: fmt, arguments
func (_m *MockShellWriter) Errorf(fmt string, arguments ...interface{}) {
	var _ca []interface{}
	_ca = append(_ca, fmt)
	_ca = append(_ca, arguments...)
	_m.Called(_ca...)
}

// Finish provides a mock function with given fields: trace
func (_m *MockShellWriter) Finish(trace bool) string {
	ret := _m.Called(trace)

	var r0 string
	if rf, ok := ret.Get(0).(func(bool) string); ok {
		r0 = rf(trace)
	} else {
		r0 = ret.Get(0).(string)
	}

	return r0
}

// IfCmd provides a mock function with given fields: cmd, arguments
func (_m *MockShellWriter) IfCmd(cmd string, arguments ...string) {
	_va := make([]interface{}, len(arguments))
	for _i := range arguments {
		_va[_i] = arguments[_i]
	}
	var _ca []interface{}
	_ca = append(_ca, cmd)
	_ca = append(_ca, _va...)
	_m.Called(_ca...)
}

// IfCmdWithOutput provides a mock function with given fields: cmd, arguments
func (_m *MockShellWriter) IfCmdWithOutput(cmd string, arguments ...string) {
	_va := make([]interface{}, len(arguments))
	for _i := range arguments {
		_va[_i] = arguments[_i]
	}
	var _ca []interface{}
	_ca = append(_ca, cmd)
	_ca = append(_ca, _va...)
	_m.Called(_ca...)
}

// IfDirectory provides a mock function with given fields: path
func (_m *MockShellWriter) IfDirectory(path string) {
	_m.Called(path)
}

// IfFile provides a mock function with given fields: file
func (_m *MockShellWriter) IfFile(file string) {
	_m.Called(file)
}

// Join provides a mock function with given fields: elem
func (_m *MockShellWriter) Join(elem ...string) string {
	_va := make([]interface{}, len(elem))
	for _i := range elem {
		_va[_i] = elem[_i]
	}
	var _ca []interface{}
	_ca = append(_ca, _va...)
	ret := _m.Called(_ca...)

	var r0 string
	if rf, ok := ret.Get(0).(func(...string) string); ok {
		r0 = rf(elem...)
	} else {
		r0 = ret.Get(0).(string)
	}

	return r0
}

// Line provides a mock function with given fields: text
func (_m *MockShellWriter) Line(text string) {
	_m.Called(text)
}

// MkDir provides a mock function with given fields: path
func (_m *MockShellWriter) MkDir(path string) {
	_m.Called(path)
}

// MkTmpDir provides a mock function with given fields: name
func (_m *MockShellWriter) MkTmpDir(name string) string {
	ret := _m.Called(name)

	var r0 string
	if rf, ok := ret.Get(0).(func(string) string); ok {
		r0 = rf(name)
	} else {
		r0 = ret.Get(0).(string)
	}

	return r0
}

// Noticef provides a mock function with given fields: fmt, arguments
func (_m *MockShellWriter) Noticef(fmt string, arguments ...interface{}) {
	var _ca []interface{}
	_ca = append(_ca, fmt)
	_ca = append(_ca, arguments...)
	_m.Called(_ca...)
}

// Printf provides a mock function with given fields: fmt, arguments
func (_m *MockShellWriter) Printf(fmt string, arguments ...interface{}) {
	var _ca []interface{}
	_ca = append(_ca, fmt)
	_ca = append(_ca, arguments...)
	_m.Called(_ca...)
}

// RmDir provides a mock function with given fields: path
func (_m *MockShellWriter) RmDir(path string) {
	_m.Called(path)
}

// RmFile provides a mock function with given fields: path
func (_m *MockShellWriter) RmFile(path string) {
	_m.Called(path)
}

// RmFilesRecursive provides a mock function with given fields: path, name
func (_m *MockShellWriter) RmFilesRecursive(path string, name string) {
	_m.Called(path, name)
}

// SectionEnd provides a mock function with given fields: id
func (_m *MockShellWriter) SectionEnd(id string) {
	_m.Called(id)
}

// SectionStart provides a mock function with given fields: id, command
func (_m *MockShellWriter) SectionStart(id string, command string) {
	_m.Called(id, command)
}

// TmpFile provides a mock function with given fields: name
func (_m *MockShellWriter) TmpFile(name string) string {
	ret := _m.Called(name)

	var r0 string
	if rf, ok := ret.Get(0).(func(string) string); ok {
		r0 = rf(name)
	} else {
		r0 = ret.Get(0).(string)
	}

	return r0
}

// Variable provides a mock function with given fields: variable
func (_m *MockShellWriter) Variable(variable common.JobVariable) {
	_m.Called(variable)
}

// Warningf provides a mock function with given fields: fmt, arguments
func (_m *MockShellWriter) Warningf(fmt string, arguments ...interface{}) {
	var _ca []interface{}
	_ca = append(_ca, fmt)
	_ca = append(_ca, arguments...)
	_m.Called(_ca...)
}

type mockConstructorTestingTNewMockShellWriter interface {
	mock.TestingT
	Cleanup(func())
}

// NewMockShellWriter creates a new instance of MockShellWriter. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
func NewMockShellWriter(t mockConstructorTestingTNewMockShellWriter) *MockShellWriter {
	mock := &MockShellWriter{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

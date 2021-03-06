/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @emails react-core
 */

'use strict';

var React;
var ReactDOM;
var ReactDOMFeatureFlags;

var TestComponent;

describe('ReactCompositeComponent-state', () => {

  beforeEach(() => {
    React = require('React');

    ReactDOM = require('ReactDOM');
    ReactDOMFeatureFlags = require('ReactDOMFeatureFlags');

    TestComponent = React.createClass({
      peekAtState: function(from, state) {
        state = state || this.state;
        this.props.stateListener(from, state && state.color);
      },

      peekAtCallback: function(from) {
        return () => this.peekAtState(from);
      },

      setFavoriteColor: function(nextColor) {
        this.setState(
          {color: nextColor},
          this.peekAtCallback('setFavoriteColor')
        );
      },

      getInitialState: function() {
        this.peekAtState('getInitialState');
        return {color: 'red'};
      },

      render: function() {
        this.peekAtState('render');
        return <div>{this.state.color}</div>;
      },

      componentWillMount: function() {
        this.peekAtState('componentWillMount-start');
        this.setState(function(state) {
          this.peekAtState('before-setState-sunrise', state);
        });
        this.setState(
          {color: 'sunrise'},
          this.peekAtCallback('setState-sunrise')
        );
        this.setState(function(state) {
          this.peekAtState('after-setState-sunrise', state);
        });
        this.peekAtState('componentWillMount-after-sunrise');
        this.setState(
          {color: 'orange'},
          this.peekAtCallback('setState-orange')
        );
        this.setState(function(state) {
          this.peekAtState('after-setState-orange', state);
        });
        this.peekAtState('componentWillMount-end');
      },

      componentDidMount: function() {
        this.peekAtState('componentDidMount-start');
        this.setState(
          {color: 'yellow'},
          this.peekAtCallback('setState-yellow')
        );
        this.peekAtState('componentDidMount-end');
      },

      componentWillReceiveProps: function(newProps) {
        this.peekAtState('componentWillReceiveProps-start');
        if (newProps.nextColor) {
          this.setState(function(state) {
            this.peekAtState('before-setState-receiveProps', state);
            return {color: newProps.nextColor};
          });
          this.replaceState({color: undefined});
          this.setState(
            function(state) {
              this.peekAtState('before-setState-again-receiveProps', state);
              return {color: newProps.nextColor};
            },
            this.peekAtCallback('setState-receiveProps')
          );
          this.setState(function(state) {
            this.peekAtState('after-setState-receiveProps', state);
          });
        }
        this.peekAtState('componentWillReceiveProps-end');
      },

      shouldComponentUpdate: function(nextProps, nextState) {
        this.peekAtState('shouldComponentUpdate-currentState');
        this.peekAtState('shouldComponentUpdate-nextState', nextState);
        return true;
      },

      componentWillUpdate: function(nextProps, nextState) {
        this.peekAtState('componentWillUpdate-currentState');
        this.peekAtState('componentWillUpdate-nextState', nextState);
      },

      componentDidUpdate: function(prevProps, prevState) {
        this.peekAtState('componentDidUpdate-currentState');
        this.peekAtState('componentDidUpdate-prevState', prevState);
      },

      componentWillUnmount: function() {
        this.peekAtState('componentWillUnmount');
      },
    });
  });

  it('should support setting state', () => {
    var container = document.createElement('div');
    document.body.appendChild(container);

    var stateListener = jest.fn();
    var instance = ReactDOM.render(
      <TestComponent stateListener={stateListener} />,
      container,
      function peekAtInitialCallback() {
        this.peekAtState('initial-callback');
      }
    );
    ReactDOM.render(
      <TestComponent stateListener={stateListener} nextColor="green" />,
      container,
      instance.peekAtCallback('setProps')
    );
    instance.setFavoriteColor('blue');
    instance.forceUpdate(instance.peekAtCallback('forceUpdate'));

    ReactDOM.unmountComponentAtNode(container);

    let expected = [
      // there is no state when getInitialState() is called
      ['getInitialState', null],
      ['componentWillMount-start', 'red'],
      // setState()'s only enqueue pending states.
      ['componentWillMount-after-sunrise', 'red'],
      ['componentWillMount-end', 'red'],
      // pending state queue is processed
      ['before-setState-sunrise', 'red'],
      ['after-setState-sunrise', 'sunrise'],
      ['after-setState-orange', 'orange'],
      // pending state has been applied
      ['render', 'orange'],
      ['componentDidMount-start', 'orange'],
      // setState-sunrise and setState-orange should be called here,
      // after the bug in #1740
      // componentDidMount() called setState({color:'yellow'}), which is async.
      // The update doesn't happen until the next flush.
      ['componentDidMount-end', 'orange'],
    ];

    // The setState callbacks in componentWillMount, and the initial callback
    // passed to ReactDOM.render, should be flushed right after component
    // did mount:
    expected.push(
      ['setState-sunrise', 'orange'], // 1
      ['setState-orange', 'orange'], // 2
      ['initial-callback', 'orange'], // 3
      ['shouldComponentUpdate-currentState', 'orange'],
      ['shouldComponentUpdate-nextState', 'yellow'],
      ['componentWillUpdate-currentState', 'orange'],
      ['componentWillUpdate-nextState', 'yellow'],
      ['render', 'yellow'],
      ['componentDidUpdate-currentState', 'yellow'],
      ['componentDidUpdate-prevState', 'orange'],
      ['setState-yellow', 'yellow'],
    );

    expected.push(
      ['componentWillReceiveProps-start', 'yellow'],
      // setState({color:'green'}) only enqueues a pending state.
      ['componentWillReceiveProps-end', 'yellow'],
      // pending state queue is processed
      // before-setState-receiveProps never called, due to replaceState.
      ['before-setState-again-receiveProps', undefined],
      ['after-setState-receiveProps', 'green'],
      ['shouldComponentUpdate-currentState', 'yellow'],
      ['shouldComponentUpdate-nextState', 'green'],
      ['componentWillUpdate-currentState', 'yellow'],
      ['componentWillUpdate-nextState', 'green'],
      ['render', 'green'],
      ['componentDidUpdate-currentState', 'green'],
      ['componentDidUpdate-prevState', 'yellow'],
      ['setState-receiveProps', 'green'],
      ['setProps', 'green'],
      // setFavoriteColor('blue')
      ['shouldComponentUpdate-currentState', 'green'],
      ['shouldComponentUpdate-nextState', 'blue'],
      ['componentWillUpdate-currentState', 'green'],
      ['componentWillUpdate-nextState', 'blue'],
      ['render', 'blue'],
      ['componentDidUpdate-currentState', 'blue'],
      ['componentDidUpdate-prevState', 'green'],
      ['setFavoriteColor', 'blue'],
      // forceUpdate()
      ['componentWillUpdate-currentState', 'blue'],
      ['componentWillUpdate-nextState', 'blue'],
      ['render', 'blue'],
      ['componentDidUpdate-currentState', 'blue'],
      ['componentDidUpdate-prevState', 'blue'],
      ['forceUpdate', 'blue'],
      // unmountComponent()
      // state is available within `componentWillUnmount()`
      ['componentWillUnmount', 'blue'],
    );

    expect(stateListener.mock.calls.join('\n')).toEqual(expected.join('\n'));
  });


  it('should call componentDidUpdate of children first', () => {
    var container = document.createElement('div');

    var ops = [];

    var child = null;
    var parent = null;

    class Child extends React.Component {
      state = {bar:false};
      componentDidMount() {
        child = this;
      }
      componentDidUpdate() {
        ops.push('child did update');
      }
      render() {
        return <div />;
      }
    }

    var shouldUpdate = true;

    class Intermediate extends React.Component {
      shouldComponentUpdate() {
        return shouldUpdate;
      }
      render() {
        return <Child />;
      }
    }

    class Parent extends React.Component {
      state = {foo:false};
      componentDidMount() {
        parent = this;
      }
      componentDidUpdate() {
        ops.push('parent did update');
      }
      render() {
        return <Intermediate />;
      }
    }

    ReactDOM.render(<Parent />, container);

    ReactDOM.unstable_batchedUpdates(() => {
      parent.setState({ foo: true });
      child.setState({ bar: true });
    });
    // When we render changes top-down in a batch, children's componentDidUpdate
    // happens before the parent.
    expect(ops).toEqual([
      'child did update',
      'parent did update',
    ]);

    shouldUpdate = false;

    ops = [];

    ReactDOM.unstable_batchedUpdates(() => {
      parent.setState({ foo: false });
      child.setState({ bar: false });
    });
    // We expect the same thing to happen if we bail out in the middle.
    expect(ops).toEqual(
      ReactDOMFeatureFlags.useFiber ?
      [
        // Fiber works as expected
        'child did update',
        'parent did update',
      ] : [
        // Stack treats these as two separate updates and therefore the order
        // is inverse.
        'parent did update',
        'child did update',
      ]
    );

  });

  it('should batch unmounts', () => {
    var outer;

    class Inner extends React.Component {
      render() {
        return <div />;
      }

      componentWillUnmount() {
        // This should get silently ignored (maybe with a warning), but it
        // shouldn't break React.
        outer.setState({showInner: false});
      }
    }

    class Outer extends React.Component {
      state = {showInner: true};

      render() {
        return <div>{this.state.showInner && <Inner />}</div>;
      }
    }

    var container = document.createElement('div');
    outer = ReactDOM.render(<Outer />, container);
    expect(() => {
      ReactDOM.unmountComponentAtNode(container);
    }).not.toThrow();
  });

  it('should update state when called from child cWRP', function() {
    const log = [];
    class Parent extends React.Component {
      state = {value: 'one'};
      render() {
        log.push('parent render ' + this.state.value);
        return <Child parent={this} value={this.state.value} />;
      }
    }
    let updated = false;
    class Child extends React.Component {
      componentWillReceiveProps() {
        if (updated) {
          return;
        }
        log.push('child componentWillReceiveProps ' + this.props.value);
        this.props.parent.setState({value: 'two'});
        log.push('child componentWillReceiveProps done ' + this.props.value);
        updated = true;
      }
      render() {
        log.push('child render ' + this.props.value);
        return <div>{this.props.value}</div>;
      }
    }
    var container = document.createElement('div');
    ReactDOM.render(<Parent />, container);
    ReactDOM.render(<Parent />, container);
    expect(log).toEqual([
      'parent render one',
      'child render one',
      'parent render one',
      'child componentWillReceiveProps one',
      'child componentWillReceiveProps done one',
      'child render one',
      'parent render two',
      'child render two',
    ]);
  });
});

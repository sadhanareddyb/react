/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment node
 */

/* eslint-disable no-func-assign */

'use strict';

describe('useRef', () => {
  let React;
  let ReactNoop;
  let Scheduler;
  let act;
  let useCallback;
  let useEffect;
  let useRef;
  let useState;

  beforeEach(() => {
    React = require('react');
    ReactNoop = require('react-noop-renderer');
    Scheduler = require('scheduler');

    const ReactFeatureFlags = require('shared/ReactFeatureFlags');
    ReactFeatureFlags.debugRenderPhaseSideEffectsForStrictMode = false;

    act = ReactNoop.act;
    useCallback = React.useCallback;
    useEffect = React.useEffect;
    useRef = React.useRef;
    useState = React.useState;
  });

  function Text(props) {
    Scheduler.unstable_yieldValue(props.text);
    return <span prop={props.text} />;
  }

  it('creates a ref object initialized with the provided value', () => {
    jest.useFakeTimers();

    function useDebouncedCallback(callback, ms, inputs) {
      const timeoutID = useRef(-1);
      useEffect(() => {
        return function unmount() {
          clearTimeout(timeoutID.current);
        };
      }, []);
      const debouncedCallback = useCallback(
        (...args) => {
          clearTimeout(timeoutID.current);
          timeoutID.current = setTimeout(callback, ms, ...args);
        },
        [callback, ms],
      );
      return useCallback(debouncedCallback, inputs);
    }

    let ping;
    function App() {
      ping = useDebouncedCallback(
        value => {
          Scheduler.unstable_yieldValue('ping: ' + value);
        },
        100,
        [],
      );
      return null;
    }

    act(() => {
      ReactNoop.render(<App />);
    });
    expect(Scheduler).toHaveYielded([]);

    ping(1);
    ping(2);
    ping(3);

    expect(Scheduler).toHaveYielded([]);

    jest.advanceTimersByTime(100);

    expect(Scheduler).toHaveYielded(['ping: 3']);

    ping(4);
    jest.advanceTimersByTime(20);
    ping(5);
    ping(6);
    jest.advanceTimersByTime(80);

    expect(Scheduler).toHaveYielded([]);

    jest.advanceTimersByTime(20);
    expect(Scheduler).toHaveYielded(['ping: 6']);
  });

  it('should return the same ref during re-renders', () => {
    function Counter() {
      const ref = useRef('val');
      const [count, setCount] = useState(0);
      const [firstRef] = useState(ref);

      if (firstRef !== ref) {
        throw new Error('should never change');
      }

      if (count < 3) {
        setCount(count + 1);
      }

      return <Text text={ref.current} />;
    }

    ReactNoop.render(<Counter />);
    expect(Scheduler).toFlushAndYield(['val']);

    ReactNoop.render(<Counter />);
    expect(Scheduler).toFlushAndYield(['val']);
  });
});

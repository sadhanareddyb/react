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
  let useLayoutEffect;
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
    useLayoutEffect = React.useLayoutEffect;
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

  if (__DEV__) {
    it('should not warn about reads if value is not mutated', () => {
      function Example() {
        const ref = useRef(123);
        return ref.current;
      }

      act(() => {
        ReactNoop.render(<Example />);
      });
    });

    it('should warn about reads during render phase if value has been mutated', () => {
      function Example() {
        const ref = useRef(123);
        ref.current = 456;

        let value;
        expect(() => {
          value = ref.current;
        }).toWarnDev([
          'Example: Unsafe read of a mutable value during render.',
        ]);

        return value;
      }

      act(() => {
        ReactNoop.render(<Example />);
      });
    });

    it('should not warn about lazy init during render', () => {
      function Example() {
        const ref1 = useRef(null);
        const ref2 = useRef();
        if (ref1.current === null) {
          // Read 1: safe because null
          ref1.current = 123;
          ref2.current = 123;
        }
        return ref1.current + ref2.current; // Read 2: safe because lazy init
      }

      act(() => {
        ReactNoop.render(<Example />);
      });
    });

    it('should not warn about lazy init outside of render', () => {
      function Example() {
        // eslint-disable-next-line no-unused-vars
        const [didMount, setDidMount] = useState(false);
        const ref1 = useRef(null);
        const ref2 = useRef();
        useLayoutEffect(() => {
          ref1.current = 123;
          ref2.current = 123;
          setDidMount(true);
        }, []);
        return ref1.current + ref2.current; // Read 2: safe because lazy init
      }

      act(() => {
        ReactNoop.render(<Example />);
      });
    });

    it('should warn about updates to ref after lazy init pattern', () => {
      function Example() {
        const ref1 = useRef(null);
        const ref2 = useRef();
        if (ref1.current === null) {
          // Read 1: safe because null
          ref1.current = 123;
          ref2.current = 123;
        }
        expect(ref1.current).toBe(123); // Read 2: safe because lazy init
        expect(ref2.current).toBe(123); // Read 2: safe because lazy init

        ref1.current = 456; // Second mutation, now reads will be unsafe
        ref2.current = 456; // Second mutation, now reads will be unsafe

        expect(() => {
          expect(ref1.current).toBe(456); // Read 3: unsafe because mutation
        }).toWarnDev([
          'Example: Unsafe read of a mutable value during render.',
        ]);
        expect(() => {
          expect(ref2.current).toBe(456); // Read 3: unsafe because mutation
        }).toWarnDev([
          'Example: Unsafe read of a mutable value during render.',
        ]);

        return null;
      }

      act(() => {
        ReactNoop.render(<Example />);
      });
    });

    it('should not warn about reads within effect', () => {
      function Example() {
        const ref = useRef(123);
        ref.current = 456;
        useLayoutEffect(() => {
          expect(ref.current).toBe(456);
        }, []);
        useEffect(() => {
          expect(ref.current).toBe(456);
        }, []);
        return null;
      }

      act(() => {
        ReactNoop.render(<Example />);
      });

      ReactNoop.flushPassiveEffects();
    });

    it('should not warn about reads outside of render phase (e.g. event handler)', () => {
      let ref;
      function Example() {
        ref = useRef(123);
        ref.current = 456;
        return null;
      }

      act(() => {
        ReactNoop.render(<Example />);
      });

      expect(ref.current).toBe(456);
    });
  }
});

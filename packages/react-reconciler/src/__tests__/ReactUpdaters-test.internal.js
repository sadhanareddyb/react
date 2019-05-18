/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

let React;
let ReactFeatureFlags;
let ReactDOM;
let ReactTestRenderer;
let ReactTestUtils;
let Scheduler;
let mockDevToolsHook;
let allSchedulerTags;
let allSchedulerTypes;
let onCommitRootShouldYield;

function loadModules({useDOMRenderer = true} = {}) {
  jest.resetModules();

  allSchedulerTags = [];
  allSchedulerTypes = [];

  onCommitRootShouldYield = true;

  mockDevToolsHook = {
    injectInternals: jest.fn(() => {}),
    onCommitRoot: jest.fn(fiberRoot => {
      if (onCommitRootShouldYield) {
        Scheduler.yieldValue('onCommitRoot');
      }
      const schedulerTags = [];
      const schedulerTypes = [];
      fiberRoot.memoizedUpdaters.forEach(fiber => {
        schedulerTags.push(fiber.tag);
        schedulerTypes.push(fiber.elementType);
      });
      allSchedulerTags.push(schedulerTags);
      allSchedulerTypes.push(schedulerTypes);
    }),
    onCommitUnmount: jest.fn(() => {}),
    isDevToolsPresent: true,
  };

  jest.mock(
    'react-reconciler/src/ReactFiberDevToolsHook',
    () => mockDevToolsHook,
  );

  ReactFeatureFlags = require('shared/ReactFeatureFlags');
  ReactFeatureFlags.enableUpdaterTracking = true;
  ReactFeatureFlags.debugRenderPhaseSideEffectsForStrictMode = false;

  React = require('react');
  if (useDOMRenderer) {
    ReactDOM = require('react-dom');
    ReactTestUtils = require('react-dom/test-utils');
  } else {
    ReactTestRenderer = require('react-test-renderer');
  }
  Scheduler = require('scheduler');
}

describe('updaters', () => {
  beforeEach(() => loadModules());

  it('should report the (host) root as the scheduler for root-level render', () => {
    const {HostRoot} = require('shared/ReactWorkTags');

    const Parent = () => <Child />;
    const Child = () => null;
    const container = document.createElement('div');

    ReactTestUtils.act(() => {
      ReactDOM.render(<Parent />, container);
    });
    expect(allSchedulerTags).toHaveLength(1);
    expect(allSchedulerTags[0]).toHaveLength(1);
    expect(allSchedulerTags[0]).toContain(HostRoot);

    ReactTestUtils.act(() => {
      ReactDOM.render(<Parent />, container);
    });
    expect(allSchedulerTags).toHaveLength(2);
    expect(allSchedulerTags[1]).toHaveLength(1);
    expect(allSchedulerTags[1]).toContain(HostRoot);
  });

  it('should report a function component as the scheduler for a hooks update', () => {
    let scheduleForA = null;
    let scheduleForB = null;

    const Parent = () => (
      <React.Fragment>
        <SchedulingComponentA />
        <SchedulingComponentB />
      </React.Fragment>
    );
    const SchedulingComponentA = () => {
      const [count, setCount] = React.useState(0);
      scheduleForA = () => setCount(prevCount => prevCount + 1);
      return <Child count={count} />;
    };
    const SchedulingComponentB = () => {
      const [count, setCount] = React.useState(0);
      scheduleForB = () => setCount(prevCount => prevCount + 1);
      return <Child count={count} />;
    };
    const Child = () => null;

    ReactTestUtils.act(() => {
      ReactDOM.render(<Parent />, document.createElement('div'));
    });
    expect(scheduleForA).not.toBeNull();
    expect(scheduleForB).not.toBeNull();
    expect(allSchedulerTypes).toHaveLength(1);

    ReactTestUtils.act(scheduleForA);
    expect(allSchedulerTypes).toHaveLength(2);
    expect(allSchedulerTypes[1]).toHaveLength(1);
    expect(allSchedulerTypes[1]).toContain(SchedulingComponentA);

    ReactTestUtils.act(scheduleForB);
    expect(allSchedulerTypes).toHaveLength(3);
    expect(allSchedulerTypes[2]).toHaveLength(1);
    expect(allSchedulerTypes[2]).toContain(SchedulingComponentB);
  });

  it('should report a class component as the scheduler for a setState update', () => {
    const Parent = () => <SchedulingComponent />;
    class SchedulingComponent extends React.Component {
      state = {};
      render() {
        instance = this;
        return <Child />;
      }
    }
    const Child = () => null;
    let instance;
    ReactTestUtils.act(() => {
      ReactDOM.render(<Parent />, document.createElement('div'));
    });
    expect(allSchedulerTypes).toHaveLength(1);

    expect(instance).not.toBeNull();
    ReactTestUtils.act(() => {
      instance.setState({});
    });
    expect(allSchedulerTypes).toHaveLength(2);
    expect(allSchedulerTypes[1]).toHaveLength(1);
    expect(allSchedulerTypes[1]).toContain(SchedulingComponent);
  });

  it('should cover cascading updates', () => {
    let triggerActiveCascade = null;
    let triggerPassiveCascade = null;

    const Parent = () => <SchedulingComponent />;
    const SchedulingComponent = () => {
      const [cascade, setCascade] = React.useState(null);
      triggerActiveCascade = () => setCascade('active');
      triggerPassiveCascade = () => setCascade('passive');
      return <CascadingChild cascade={cascade} />;
    };
    const CascadingChild = ({cascade}) => {
      const [count, setCount] = React.useState(0);
      Scheduler.yieldValue(`CascadingChild ${count}`);
      React.useLayoutEffect(
        () => {
          if (cascade === 'active') {
            setCount(prevCount => prevCount + 1);
          }
          return () => {};
        },
        [cascade],
      );
      React.useEffect(
        () => {
          if (cascade === 'passive') {
            setCount(prevCount => prevCount + 1);
          }
          return () => {};
        },
        [cascade],
      );
      return count;
    };

    const root = ReactDOM.unstable_createRoot(document.createElement('div'));
    ReactTestUtils.act(() => {
      root.render(<Parent />);
      expect(Scheduler).toFlushAndYieldThrough([
        'CascadingChild 0',
        'onCommitRoot',
      ]);
    });
    expect(triggerActiveCascade).not.toBeNull();
    expect(triggerPassiveCascade).not.toBeNull();
    expect(allSchedulerTypes).toHaveLength(1);

    ReactTestUtils.act(() => {
      triggerActiveCascade();
      expect(Scheduler).toFlushAndYieldThrough([
        'CascadingChild 0',
        'onCommitRoot',
        'CascadingChild 1',
        'onCommitRoot',
      ]);
    });
    expect(allSchedulerTypes).toHaveLength(3);
    expect(allSchedulerTypes[1]).toHaveLength(1);
    expect(allSchedulerTypes[1]).toContain(SchedulingComponent);
    expect(allSchedulerTypes[2]).toHaveLength(1);
    expect(allSchedulerTypes[2]).toContain(CascadingChild);

    ReactTestUtils.act(() => {
      triggerPassiveCascade();
      expect(Scheduler).toFlushAndYieldThrough([
        'CascadingChild 1',
        'onCommitRoot',
        'CascadingChild 2',
        'onCommitRoot',
      ]);
    });
    expect(allSchedulerTypes).toHaveLength(5);
    expect(allSchedulerTypes[3]).toHaveLength(1);
    expect(allSchedulerTypes[3]).toContain(SchedulingComponent);
    expect(allSchedulerTypes[4]).toHaveLength(1);
    expect(allSchedulerTypes[4]).toContain(CascadingChild);

    // Verify no outstanding flushes
    Scheduler.flushAll();
  });

  it('should cover suspense pings', async done => {
    let data = null;
    let resolver = null;
    let promise = null;
    const fakeCacheRead = () => {
      if (data === null) {
        promise = new Promise(resolve => {
          resolver = resolvedData => {
            data = resolvedData;
            resolve(resolvedData);
          };
        });
        throw promise;
      } else {
        return data;
      }
    };
    const Parent = () => (
      <React.Suspense fallback={<Fallback />}>
        <Suspender />
      </React.Suspense>
    );
    const Fallback = () => null;
    let setShouldSuspend = null;
    const Suspender = ({suspend}) => {
      const tuple = React.useState(false);
      setShouldSuspend = tuple[1];
      if (tuple[0] === true) {
        return fakeCacheRead();
      } else {
        return null;
      }
    };

    ReactTestUtils.act(() => {
      ReactDOM.render(<Parent />, document.createElement('div'));
      expect(Scheduler).toHaveYielded(['onCommitRoot']);
    });
    expect(setShouldSuspend).not.toBeNull();
    expect(allSchedulerTypes).toHaveLength(1);

    ReactTestUtils.act(() => {
      setShouldSuspend(true);
      expect(Scheduler).toFlushAndYieldThrough(['onCommitRoot']);
    });
    expect(allSchedulerTypes).toHaveLength(2);
    expect(allSchedulerTypes[1]).toHaveLength(1);
    expect(allSchedulerTypes[1]).toContain(Suspender);

    expect(resolver).not.toBeNull();
    await ReactTestUtils.act(() => {
      resolver('abc');
      return promise;
    });
    expect(Scheduler).toHaveYielded(['onCommitRoot']);
    expect(allSchedulerTypes).toHaveLength(3);
    expect(allSchedulerTypes[2]).toHaveLength(1);
    expect(allSchedulerTypes[2]).toContain(Suspender);

    // Verify no outstanding flushes
    Scheduler.flushAll();

    done();
  });

  it('should cover hidden/offscreen work', async done => {
    let setIncludeHiddenTree = null;

    const Parent = () => <SchedulingComponent />;
    const SchedulingComponent = () => {
      const tuple = React.useState(false);
      setIncludeHiddenTree = tuple[1];
      return (
        <React.Fragment>
          <NotHidden />
          {tuple[0] && (
            <div hidden={true}>
              <Hidden />
            </div>
          )}
        </React.Fragment>
      );
    };
    const Hidden = () => {
      Scheduler.yieldValue('Hidden');
      return null;
    };
    const NotHidden = () => {
      Scheduler.yieldValue('NotHidden');
      return null;
    };

    const root = ReactDOM.unstable_createRoot(document.createElement('div'));
    ReactTestUtils.act(() => {
      root.render(<Parent />);
      expect(Scheduler).toFlushAndYieldThrough(['NotHidden', 'onCommitRoot']);
    });
    expect(allSchedulerTypes).toHaveLength(1);

    expect(setIncludeHiddenTree).not.toBeNull();
    ReactTestUtils.act(() => {
      setIncludeHiddenTree(true);
      expect(Scheduler).toFlushAndYieldThrough(['NotHidden', 'onCommitRoot']);
      expect(allSchedulerTypes).toHaveLength(2);
      expect(allSchedulerTypes[1]).toHaveLength(1);
      expect(allSchedulerTypes[1]).toContain(SchedulingComponent);

      expect(Scheduler).toFlushAndYieldThrough(['Hidden', 'onCommitRoot']);
      expect(allSchedulerTypes).toHaveLength(3);
      expect(allSchedulerTypes[2]).toHaveLength(1);
      expect(allSchedulerTypes[2]).toContain(SchedulingComponent);
    });

    // Verify no outstanding flushes
    Scheduler.flushAll();

    done();
  });

  it('should cover error handling', () => {
    let triggerError = null;

    const Parent = () => {
      const [shouldError, setShouldError] = React.useState(false);
      triggerError = () => setShouldError(true);
      return shouldError ? (
        <ErrorBoundary>
          <BrokenRender />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <Yield value="initial" />
        </ErrorBoundary>
      );
    };
    class ErrorBoundary extends React.Component {
      state = {error: null};
      componentDidCatch(error) {
        this.setState({error});
      }
      render() {
        if (this.state.error) {
          return <Yield value="error" />;
        }
        return this.props.children;
      }
    }
    const Yield = ({value}) => {
      Scheduler.yieldValue(value);
      return null;
    };
    const BrokenRender = () => {
      throw new Error('Hello');
    };

    const root = ReactDOM.unstable_createRoot(document.createElement('div'));
    ReactTestUtils.act(() => {
      root.render(<Parent shouldError={false} />);
      expect(Scheduler).toFlushAndYieldThrough(['initial', 'onCommitRoot']);
    });
    expect(triggerError).not.toBeNull();

    const schedulerTypes = [];

    // TODO DELETE THIS
    mockDevToolsHook.onCommitRoot.mockImplementation(fiberRoot => {
      Scheduler.yieldValue('onCommitRoot');
      schedulerTypes.push(
        Array.from(fiberRoot.memoizedUpdaters).map(fiber => fiber.elementType),
      );
    });

    ReactTestUtils.act(() => {
      triggerError();
      expect(Scheduler).toFlushAndYieldThrough([
        'onCommitRoot',
        'error',
        'onCommitRoot',
      ]);
    });
    expect(schedulerTypes).toHaveLength(2);
    expect(schedulerTypes[0]).toHaveLength(1);
    expect(schedulerTypes[0]).toContain(Parent);
    expect(schedulerTypes[1]).toHaveLength(1);
    expect(schedulerTypes[1]).toContain(ErrorBoundary);

    // Verify no outstanding flushes
    Scheduler.flushAll();
  });

  it('should distinguish between updaters in the case of interleaved work', () => {
    let triggerLowPriorityUpdate = null;
    let triggerSyncPriorityUpdate = null;

    const HighPriorityUpdater = () => {
      const [count, setCount] = React.useState(0);
      triggerSyncPriorityUpdate = () => setCount(prevCount => prevCount + 1);
      Scheduler.yieldValue(`HighPriorityUpdater ${count}`);
      return <Yield value={`HighPriority ${count}`} />;
    };
    const LowPriorityUpdater = () => {
      const [count, setCount] = React.useState(0);
      triggerLowPriorityUpdate = () => setCount(prevCount => prevCount + 1);
      Scheduler.yieldValue(`LowPriorityUpdater ${count}`);
      return <Yield value={`LowPriority ${count}`} />;
    };
    const Yield = ({value}) => {
      Scheduler.yieldValue(`Yield ${value}`);
      return null;
    };

    const root = ReactDOM.unstable_createRoot(document.createElement('div'));
    ReactTestUtils.act(() => {
      root.render(
        <React.Fragment>
          <HighPriorityUpdater />
          <LowPriorityUpdater />
        </React.Fragment>,
      );
      expect(Scheduler).toFlushAndYieldThrough([
        'HighPriorityUpdater 0',
        'Yield HighPriority 0',
        'LowPriorityUpdater 0',
        'Yield LowPriority 0',
        'onCommitRoot',
      ]);
    });
    expect(triggerLowPriorityUpdate).not.toBeNull();
    expect(triggerSyncPriorityUpdate).not.toBeNull();
    expect(allSchedulerTypes).toHaveLength(1);

    // Render a partially update, but don't finish.
    ReactTestUtils.act(() => {
      triggerLowPriorityUpdate();
      expect(Scheduler).toFlushAndYieldThrough(['LowPriorityUpdater 1']);
      expect(allSchedulerTypes).toHaveLength(1);

      // Interrupt with higher priority work.
      ReactDOM.flushSync(triggerSyncPriorityUpdate);
      expect(Scheduler).toHaveYielded([
        'HighPriorityUpdater 1',
        'Yield HighPriority 1',
        'onCommitRoot',
      ]);
      expect(allSchedulerTypes).toHaveLength(2);
      expect(allSchedulerTypes[1]).toHaveLength(1);
      expect(allSchedulerTypes[1]).toContain(HighPriorityUpdater);

      // Finish the initial partial update
      triggerLowPriorityUpdate();
      expect(Scheduler).toFlushAndYieldThrough([
        'LowPriorityUpdater 2',
        'Yield LowPriority 2',
        'onCommitRoot',
      ]);
    });
    expect(allSchedulerTypes).toHaveLength(3);
    expect(allSchedulerTypes[2]).toHaveLength(1);
    expect(allSchedulerTypes[2]).toContain(LowPriorityUpdater);

    // Verify no outstanding flushes
    Scheduler.flushAll();
  });

  it('should not lose track of updaters if work yields before finishing', () => {
    loadModules({useDOMRenderer: false});

    const {HostRoot} = require('shared/ReactWorkTags');

    const Yield = ({renderTime}) => {
      Scheduler.advanceTime(renderTime);
      Scheduler.yieldValue('Yield:' + renderTime);
      return null;
    };

    let first;
    class FirstComponent extends React.Component {
      state = {renderTime: 1};
      render() {
        first = this;
        Scheduler.advanceTime(this.state.renderTime);
        Scheduler.yieldValue('FirstComponent:' + this.state.renderTime);
        return <Yield renderTime={4} />;
      }
    }
    let second;
    class SecondComponent extends React.Component {
      state = {renderTime: 2};
      render() {
        second = this;
        Scheduler.advanceTime(this.state.renderTime);
        Scheduler.yieldValue('SecondComponent:' + this.state.renderTime);
        return <Yield renderTime={7} />;
      }
    }

    Scheduler.advanceTime(5); // 0 -> 5

    const renderer = ReactTestRenderer.create(
      <React.Fragment>
        <FirstComponent />
        <SecondComponent />
      </React.Fragment>,
      {unstable_isConcurrent: true},
    );

    // Render everything initially.
    expect(Scheduler).toFlushAndYield([
      'FirstComponent:1',
      'Yield:4',
      'SecondComponent:2',
      'Yield:7',
      'onCommitRoot',
    ]);
    expect(allSchedulerTags).toHaveLength(1);
    expect(allSchedulerTags[0]).toHaveLength(1);
    expect(allSchedulerTags[0]).toContain(HostRoot);

    // Render a partially update, but don't finish.
    first.setState({renderTime: 10});
    expect(Scheduler).toFlushAndYieldThrough(['FirstComponent:10']);
    expect(allSchedulerTypes).toHaveLength(1);

    // Interrupt with higher priority work.
    renderer.unstable_flushSync(() => second.setState({renderTime: 30}));
    expect(Scheduler).toHaveYielded([
      'SecondComponent:30',
      'Yield:7',
      'onCommitRoot',
    ]);
    expect(allSchedulerTypes).toHaveLength(2);
    expect(allSchedulerTypes[1]).toHaveLength(1);
    expect(allSchedulerTypes[1]).toContain(SecondComponent);

    // Resume the original low priority update.
    expect(Scheduler).toFlushAndYield([
      'FirstComponent:10',
      'Yield:4',
      'onCommitRoot',
    ]);
    expect(allSchedulerTypes).toHaveLength(3);
    expect(allSchedulerTypes[2]).toHaveLength(1);
    expect(allSchedulerTypes[2]).toContain(FirstComponent);
  });
});

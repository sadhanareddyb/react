let React;
let ReactTestRenderer;
let ReactFeatureFlags;
let ReactCache;
let SuspenseRenderProp;

// let JestReact;

let TextResource;
let textResourceShouldFail;

// Additional tests can be found in ReactSuspenseWithNoopRenderer. Plan is
// to gradually migrate those to this file.
// TODO (bvaughn+suspense) Rename this to something better
describe('ReactSuspenseRenderProp', () => {
  beforeEach(() => {
    jest.resetModules();
    ReactFeatureFlags = require('shared/ReactFeatureFlags');
    ReactFeatureFlags.debugRenderPhaseSideEffectsForStrictMode = false;
    ReactFeatureFlags.replayFailedUnitOfWorkWithInvokeGuardedCallback = false;
    ReactFeatureFlags.enableHooks = true;
    React = require('react');
    ReactTestRenderer = require('react-test-renderer');
    ReactCache = require('react-cache');

    SuspenseRenderProp = React.unstable_SuspenseRenderProp;

    TextResource = ReactCache.unstable_createResource(([text, ms = 0]) => {
      let listeners = null;
      let status = 'pending';
      let value = null;
      return {
        then(resolve, reject) {
          switch (status) {
            case 'pending': {
              if (listeners === null) {
                listeners = [{resolve, reject}];
                setTimeout(() => {
                  if (textResourceShouldFail) {
                    ReactTestRenderer.unstable_yield(
                      `Promise rejected [${text}]`,
                    );
                    status = 'rejected';
                    value = new Error('Failed to load: ' + text);
                    listeners.forEach(listener => listener.reject(value));
                  } else {
                    ReactTestRenderer.unstable_yield(
                      `Promise resolved [${text}]`,
                    );
                    status = 'resolved';
                    value = text;
                    listeners.forEach(listener => listener.resolve(value));
                  }
                }, ms);
              } else {
                listeners.push({resolve, reject});
              }
              break;
            }
            case 'resolved': {
              resolve(value);
              break;
            }
            case 'rejected': {
              reject(value);
              break;
            }
          }
        },
      };
    }, ([text, ms]) => text);
    textResourceShouldFail = false;
  });

  function AsyncText({ms, text}) {
    try {
      TextResource.read([text, ms]);
      ReactTestRenderer.unstable_yield(text);
      return text;
    } catch (promise) {
      if (typeof promise.then === 'function') {
        ReactTestRenderer.unstable_yield(`Suspend! [${text}]`);
      } else {
        ReactTestRenderer.unstable_yield(`Error! [${text}]`);
      }
      throw promise;
    }
  }

  function Text({text}) {
    ReactTestRenderer.unstable_yield(text);
    return text;
  }

  it('passes through when nothing suspends', () => {
    const root = ReactTestRenderer.create(
      <SuspenseRenderProp>
        {didExpire =>
          didExpire ? <Text text={'Loading...'} /> : <Text text="Loaded" />
        }
      </SuspenseRenderProp>,
      {
        unstable_isConcurrent: true,
      },
    );

    expect(root).toFlushAndYield(['Loaded']);
    expect(root).toMatchRenderedOutput('Loaded');
  });

  // TODO Component gets stuck in sync mode
  fit('suspends rendering and continues later in sync mode', () => {
    const root = ReactTestRenderer.create(
      <SuspenseRenderProp>
        {didExpire =>
          didExpire ? (
            <Text text={'Loading...'} />
          ) : (
            <AsyncText text="foo" ms={100} />
          )
        }
      </SuspenseRenderProp>,
    );

    expect(ReactTestRenderer).toHaveYielded(['Suspend! [foo]', 'Loading...']);
    expect(root).toMatchRenderedOutput(null);

    // Flush some of the time, but not enough to resolve the suspended resource
    jest.advanceTimersByTime(50);
    expect(root).toFlushWithoutYielding();
    expect(root).toMatchRenderedOutput(null);

    // Flush the promise completely
    jest.advanceTimersByTime(50);
    expect(ReactTestRenderer).toHaveYielded(['Promise resolved [foo]']);
    expect(root).toFlushAndYield(['foo']);
    expect(root).toMatchRenderedOutput('foo');
  });

  it('suspends rendering and continues later in concurrent mode', () => {
    const root = ReactTestRenderer.create(
      <SuspenseRenderProp>
        {didExpire =>
          didExpire ? (
            <Text text={'Loading...'} />
          ) : (
            <AsyncText text="foo" ms={100} />
          )
        }
      </SuspenseRenderProp>,
      {
        unstable_isConcurrent: true,
      },
    );

    expect(root).toFlushAndYield(['Suspend! [foo]', 'Loading...']);
    expect(root).toMatchRenderedOutput(null);

    // Flush some of the time, but not enough to resolve the suspended resource
    jest.advanceTimersByTime(50);
    expect(root).toFlushWithoutYielding();
    expect(root).toMatchRenderedOutput(null);

    // Flush the promise completely
    jest.advanceTimersByTime(50);
    expect(ReactTestRenderer).toHaveYielded(['Promise resolved [foo]']);
    expect(root).toFlushAndYield(['foo']);
    expect(root).toMatchRenderedOutput('foo');
  });

  describe('bubbles up to the next parent if a suspended child throws again', () => {
    it('for nested SuspenseRenderProps', () => {
      const root = ReactTestRenderer.create(
        <SuspenseRenderProp id="outer">
          {didExpireOuter =>
            didExpireOuter ? (
              <Text text={'Loading...'} />
            ) : (
              <SuspenseRenderProp id="inner">
                {didExpireInner => <AsyncText text="foo" ms={100} />}
              </SuspenseRenderProp>
            )
          }
        </SuspenseRenderProp>,
        {
          unstable_isConcurrent: true,
        },
      );

      expect(root).toFlushAndYield([
        'Suspend! [foo]',
        'Suspend! [foo]',
        'Loading...',
      ]);
      expect(root).toMatchRenderedOutput(null);

      // Flush the promise completely
      jest.advanceTimersByTime(100);
      expect(ReactTestRenderer).toHaveYielded(['Promise resolved [foo]']);
      expect(root).toFlushAndYield(['foo']);
      expect(root).toMatchRenderedOutput('foo');
    });

    it('for nested Suspense within SuspenseRenderProp', () => {
      const root = ReactTestRenderer.create(
        <SuspenseRenderProp id="outer">
          {didExpire =>
            didExpire ? (
              <Text text={'Loading...'} />
            ) : (
              <React.Suspense
                id="inner"
                fallback={<AsyncText text="foo" ms={100} />}>
                <AsyncText text="foo" ms={100} />
              </React.Suspense>
            )
          }
        </SuspenseRenderProp>,
        {
          unstable_isConcurrent: true,
        },
      );

      expect(root).toFlushAndYield([
        'Suspend! [foo]',
        'Suspend! [foo]',
        'Loading...',
      ]);
      expect(root).toMatchRenderedOutput(null);

      // Flush the promise completely
      jest.advanceTimersByTime(100);
      expect(ReactTestRenderer).toHaveYielded(['Promise resolved [foo]']);
      expect(root).toFlushAndYield(['foo']);
      expect(root).toMatchRenderedOutput('foo');
    });

    it('for nested SuspenseRenderProp within Suspense', () => {
      const root = ReactTestRenderer.create(
        <React.Suspense id="outer" fallback={<Text text={'Loading...'} />}>
          <SuspenseRenderProp id="inner">
            {didExpire => <AsyncText text="foo" ms={100} />}
          </SuspenseRenderProp>
        </React.Suspense>,
        {
          unstable_isConcurrent: true,
        },
      );

      expect(root).toFlushAndYield([
        'Suspend! [foo]',
        'Suspend! [foo]',
        'Loading...',
      ]);
      expect(root).toMatchRenderedOutput(null);

      // Flush the promise completely
      jest.advanceTimersByTime(100);
      expect(ReactTestRenderer).toHaveYielded(['Promise resolved [foo]']);
      expect(root).toFlushAndYield(['foo']);
      expect(root).toMatchRenderedOutput('foo');
    });
  });

  it('preserves state of children during and after suspending', () => {
    class StatefulComponent extends React.Component {
      componentWillUnmount() {
        throw Error('This component should not unmount during the test');
      }

      render() {
        if (this.props.didExpire) {
          return <Text text={'Loading...'} />;
        } else {
          return <AsyncText text="foo" ms={100} />;
        }
      }
    }

    const root = ReactTestRenderer.create(
      <SuspenseRenderProp>
        {didExpire => <StatefulComponent didExpire={didExpire} />}
      </SuspenseRenderProp>,
      {
        unstable_isConcurrent: true,
      },
    );

    expect(root).toFlushAndYield(['Suspend! [foo]', 'Loading...']);
    expect(root).toMatchRenderedOutput(null);

    // Flush the promise completely
    jest.advanceTimersByTime(100);
    expect(ReactTestRenderer).toHaveYielded(['Promise resolved [foo]']);
    expect(root).toFlushAndYield(['foo']);
    expect(root).toMatchRenderedOutput('foo');
  });
});

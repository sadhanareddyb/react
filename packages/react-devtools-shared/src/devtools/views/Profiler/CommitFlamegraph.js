/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import React, {forwardRef, useCallback, useContext, useMemo} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {SimpleList} from 'react-window';
import {ProfilerContext} from './ProfilerContext';
import NoCommitData from './NoCommitData';
import CommitFlamegraphListItem from './CommitFlamegraphListItem';
import {scale} from './utils';
import {StoreContext} from '../context';
import {SettingsContext} from '../Settings/SettingsContext';

import styles from './CommitFlamegraph.css';

import type {ChartData} from './FlamegraphChartBuilder';
import type {CommitTree} from './types';

export default function CommitFlamegraphAutoSizer(_: {||}) {
  const {profilerStore} = useContext(StoreContext);
  const {rootID, selectedCommitIndex, selectFiber} = useContext(
    ProfilerContext,
  );
  const {profilingCache} = profilerStore;

  const deselectCurrentFiber = useCallback(
    event => {
      event.stopPropagation();
      selectFiber(null, null);
    },
    [selectFiber],
  );

  let commitTree: CommitTree | null = null;
  let chartData: ChartData | null = null;
  if (selectedCommitIndex !== null) {
    commitTree = profilingCache.getCommitTree({
      commitIndex: selectedCommitIndex,
      rootID: ((rootID: any): number),
    });

    chartData = profilingCache.getFlamegraphChartData({
      commitIndex: selectedCommitIndex,
      commitTree,
      rootID: ((rootID: any): number),
    });
  }

  if (commitTree != null && chartData != null && chartData.depth > 0) {
    return (
      <div className={styles.Container} onClick={deselectCurrentFiber}>
        <AutoSizer>
          {({height, width}) => (
            // Force Flow types to avoid checking for `null` here because there's no static proof that
            // by the time this render prop function is called, the values of the `let` variables have not changed.
            <CommitFlamegraph
              chartData={((chartData: any): ChartData)}
              commitTree={((commitTree: any): CommitTree)}
              height={height}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  } else {
    return <NoCommitData />;
  }
}

type Props = {|
  chartData: ChartData,
  commitTree: CommitTree,
  height: number,
  width: number,
|};

function CommitFlamegraph({chartData, commitTree, height, width}: Props) {
  const {lineHeight} = useContext(SettingsContext);
  const {selectFiber, selectedFiberID} = useContext(ProfilerContext);

  const selectedChartNodeIndex = useMemo<number>(
    () => {
      if (selectedFiberID === null) {
        return 0;
      }
      // The selected node might not be in the tree for this commit,
      // so it's important that we have a fallback plan.
      const depth = chartData.idToDepthMap.get(selectedFiberID);
      return depth !== undefined ? depth - 1 : 0;
    },
    [chartData, selectedFiberID],
  );

  const selectedChartNode = useMemo(
    () => {
      if (selectedFiberID !== null) {
        return (
          chartData.rows[selectedChartNodeIndex].find(
            chartNode => chartNode.id === selectedFiberID,
          ) || null
        );
      }
      return null;
    },
    [chartData, selectedFiberID, selectedChartNodeIndex],
  );

  return (
    <SimpleList
      height={height}
      innerElementType={InnerElementType}
      itemCount={chartData.depth}
      itemRenderer={({index, key, style}) => (
        <CommitFlamegraphListItem
          chartData={chartData}
          index={index}
          key={key}
          scaleX={scale(
            0,
            selectedChartNode !== null
              ? selectedChartNode.treeBaseDuration
              : chartData.baseDuration,
            0,
            width,
          )}
          selectedChartNode={selectedChartNode}
          selectedChartNodeIndex={selectedChartNodeIndex}
          selectFiber={selectFiber}
          style={style}
          width={width}
        />
      )}
      itemSize={lineHeight}
      width={width}
    />
  );
}

const InnerElementType = forwardRef(({children, ...rest}, ref) => (
  <svg ref={ref} {...rest}>
    <defs>
      <pattern
        id="didNotRenderPattern"
        patternUnits="userSpaceOnUse"
        width="4"
        height="4">
        <path
          d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
          className={styles.PatternPath}
        />
      </pattern>
    </defs>
    {children}
  </svg>
));

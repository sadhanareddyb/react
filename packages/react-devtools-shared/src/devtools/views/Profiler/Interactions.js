/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import React, {useCallback, useContext} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {SimpleList} from 'react-window';
import {ProfilerContext} from './ProfilerContext';
import InteractionListItem from './InteractionListItem';
import NoInteractions from './NoInteractions';
import {StoreContext} from '../context';
import {scale} from './utils';

import styles from './Interactions.css';

export default function InteractionsAutoSizer(_: {||}) {
  return (
    <div className={styles.Container}>
      <AutoSizer>
        {({height, width}) => <Interactions height={height} width={width} />}
      </AutoSizer>
    </div>
  );
}

function Interactions({height, width}: {|height: number, width: number|}) {
  const {
    rootID,
    selectedInteractionID,
    selectInteraction,
    selectCommitIndex,
    selectTab,
  } = useContext(ProfilerContext);
  const {profilerStore} = useContext(StoreContext);
  const {profilingCache} = profilerStore;

  const dataForRoot = profilerStore.getDataForRoot(((rootID: any): number));

  const chartData = profilingCache.getInteractionsChartData({
    rootID: ((rootID: any): number),
  });

  const {interactions} = chartData;

  const handleKeyDown = useCallback(
    event => {
      let index;
      switch (event.key) {
        case 'ArrowDown':
          index = interactions.findIndex(
            interaction => interaction.id === selectedInteractionID,
          );
          selectInteraction(Math.min(interactions.length - 1, index + 1));
          event.stopPropagation();
          break;
        case 'ArrowUp':
          index = interactions.findIndex(
            interaction => interaction.id === selectedInteractionID,
          );
          selectInteraction(Math.max(0, index - 1));
          event.stopPropagation();
          break;
        default:
          break;
      }
    },
    [interactions, selectedInteractionID, selectInteraction],
  );

  // TODO Reading a mutable value during render is not safe.
  // These values should be coming from e.g. SettingsContext.
  const interactionCommitSize = parseInt(
    getComputedStyle((document.body: any)).getPropertyValue(
      '--interaction-commit-size',
    ),
    10,
  );
  const interactionLabelWidth = parseInt(
    getComputedStyle((document.body: any)).getPropertyValue(
      '--interaction-label-width',
    ),
    10,
  );

  const labelWidth = Math.min(interactionLabelWidth, width / 5);
  const timelineWidth = width - labelWidth - interactionCommitSize;

  // If a commit contains no fibers with an actualDuration > 0,
  // Display a fallback message.
  if (interactions.length === 0) {
    return <NoInteractions height={height} width={width} />;
  }

  return (
    <div className={styles.FocusTarget} onKeyDown={handleKeyDown} tabIndex={0}>
      <SimpleList
        height={height}
        itemCount={interactions.length}
        itemRenderer={({index, key, style}) => (
          <InteractionListItem
            chartData={chartData}
            dataForRoot={dataForRoot}
            index={index}
            key={key}
            labelWidth={labelWidth}
            scaleX={scale(0, chartData.lastInteractionTime, 0, timelineWidth)}
            selectedInteractionID={selectedInteractionID}
            selectCommitIndex={selectCommitIndex}
            selectInteraction={selectInteraction}
            selectTab={selectTab}
            style={style}
          />
        )}
        itemSize={30}
        width={width}
      />
    </div>
  );
}

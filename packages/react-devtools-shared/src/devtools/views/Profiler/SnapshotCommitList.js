/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import {SimpleList} from 'react-window';
import SnapshotCommitListItem from './SnapshotCommitListItem';

import styles from './SnapshotCommitList.css';

type Props = {|
  commitDurations: Array<number>,
  commitTimes: Array<number>,
  filteredCommitIndices: Array<number>,
  selectedCommitIndex: number | null,
  selectedFilteredCommitIndex: number | null,
  selectCommitIndex: (index: number) => void,
|};

export default function SnapshotCommitList({
  commitDurations,
  commitTimes,
  filteredCommitIndices,
  selectedCommitIndex,
  selectedFilteredCommitIndex,
  selectCommitIndex,
}: Props) {
  return (
    <AutoSizer>
      {({height, width}) => (
        <List
          commitDurations={commitDurations}
          commitTimes={commitTimes}
          filteredCommitIndices={filteredCommitIndices}
          height={height}
          selectedCommitIndex={selectedCommitIndex}
          selectedFilteredCommitIndex={selectedFilteredCommitIndex}
          selectCommitIndex={selectCommitIndex}
          width={width}
        />
      )}
    </AutoSizer>
  );
}

type ListProps = {|
  commitDurations: Array<number>,
  commitTimes: Array<number>,
  filteredCommitIndices: Array<number>,
  height: number,
  selectedCommitIndex: number | null,
  selectedFilteredCommitIndex: number | null,
  selectCommitIndex: (index: number) => void,
  width: number,
|};

function List({
  commitDurations,
  commitTimes,
  filteredCommitIndices,
  height,
  selectedCommitIndex,
  selectedFilteredCommitIndex,
  selectCommitIndex,
  width,
}: ListProps) {
  const listRef = useRef<SimpleList | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const prevCommitIndexRef = useRef<number | null>(null);

  // Make sure a newly selected snapshot is fully visible within the list.
  useEffect(
    () => {
      if (selectedFilteredCommitIndex !== prevCommitIndexRef.current) {
        prevCommitIndexRef.current = selectedFilteredCommitIndex;
        if (selectedFilteredCommitIndex !== null && listRef.current !== null) {
          listRef.current.scrollToItem(selectedFilteredCommitIndex);
        }
      }
    },
    [listRef, selectedFilteredCommitIndex],
  );

  // When the mouse is down, dragging over a commit should auto-select it.
  // This provides a nice way for users to swipe across a range of commits to compare them.
  const [isMouseDown, setIsMouseDown] = useState(false);
  const handleMouseDown = useCallback(() => {
    setIsMouseDown(true);
  }, []);
  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, []);
  useEffect(
    () => {
      if (divRef.current === null) {
        return;
      }

      // It's important to listen to the ownerDocument to support the browser extension.
      // Here we use portals to render individual tabs (e.g. Profiler),
      // and the root document might belong to a different window.
      const ownerDocument = divRef.current.ownerDocument;
      ownerDocument.addEventListener('mouseup', handleMouseUp);
      return () => ownerDocument.removeEventListener('mouseup', handleMouseUp);
    },
    [divRef, handleMouseUp],
  );

  useLayoutEffect(
    () => {
      if (selectedCommitIndex !== null && divRef.current !== null) {
        const child = divRef.current.children[selectedCommitIndex];
        if (child != null && typeof child.scrollIntoView === 'function') {
          child.scrollIntoView();
        }
      }
    },
    [selectedCommitIndex, width],
  );

  const maxDuration = useMemo(
    () => commitDurations.reduce((max, duration) => Math.max(max, duration), 0),
    [commitDurations],
  );

  return (
    <div
      className={styles.List}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      ref={divRef}
      style={{height, width}}>
      {filteredCommitIndices.map(index => (
        <SnapshotCommitListItem
          commitDurations={commitDurations}
          commitTimes={commitTimes}
          filteredCommitIndices={filteredCommitIndices}
          index={index}
          isMouseDown={isMouseDown}
          key={index}
          maxDuration={maxDuration}
          selectedCommitIndex={selectedCommitIndex}
          selectedFilteredCommitIndex={selectedFilteredCommitIndex}
          selectCommitIndex={selectCommitIndex}
        />
      ))}
    </div>
  );
}

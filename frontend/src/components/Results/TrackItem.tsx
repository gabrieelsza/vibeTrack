import React from 'react';
import { MusicRecommendation } from '../../types';
import { TrackListItem } from '../Poster/TrackListItem';

interface TrackItemProps {
  track: MusicRecommendation;
  onShareTrack: (track: MusicRecommendation) => void;
}

export const TrackItem: React.FC<TrackItemProps> = ({ track, onShareTrack }) => {
  return <TrackListItem track={track} onShareTrack={onShareTrack} />;
};

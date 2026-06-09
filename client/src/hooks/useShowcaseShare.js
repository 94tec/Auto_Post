// hooks/useShowcaseShare.js
import { useShareContext } from '../context/ShareContext';

export const useShowcaseShare = () => {
  const { openShare } = useShareContext();

  return {
    // For quotes / cinematic cards
    openCinematicShare: (payload) =>
      openShare({ ...payload, modalType: 'cinematic' }),

    // For Daily Cards
    openDailyCardShare: ({ cardRef, item, accent }) =>
      openShare({
        modalType: 'dailyCard',
        item,
        cardRef,
        accent,
      }),
  };
};
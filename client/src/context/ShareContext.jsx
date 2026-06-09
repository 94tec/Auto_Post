// context/ShareContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import SharePortal from '../showcase/components/SharePortal';
import CinematicShareModal from '../showcase/components/CinematicShareModal';
import DailyCardShareModal from '../showcase/components/DailyCardShareModal';

const ShareContext = createContext(null);

export const ShareProvider = ({ children }) => {
  const [state, setState] = useState({
    open: false,
    modalType: 'cinematic', // 'cinematic' | 'dailyCard'
    showcase: null,
    item: null,
    cardRef: null,        // ← Only for DailyCard
    accent: null,         // ← Only for DailyCard (optional fallback)
  });

  const openShare = useCallback((payload) => {
    setState({
      open: true,
      modalType: payload.modalType || 'cinematic',
      showcase: payload.showcase,
      item: payload.item || null,
      cardRef: payload.cardRef || null,
      accent: payload.accent || null,
    });
  }, []);

  const closeShare = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo(() => ({
    ...state,
    openShare,
    closeShare,
  }), [state, openShare, closeShare]);

  return (
    <ShareContext.Provider value={value}>
      {children}

      <SharePortal>
        {/* Cinematic Modal */}
        <CinematicShareModal
          isOpen={state.open && state.modalType === 'cinematic'}
          onClose={closeShare}
          shareData={state.open && state.modalType === 'cinematic' ? {
            showcase: state.showcase,
            item: state.item,
            type: 'quote',
          } : null}
        />

        {/* DailyCard Modal */}
        <DailyCardShareModal
          isOpen={state.open && state.modalType === 'dailyCard'}
          onClose={closeShare}
          cardRef={state.cardRef}
          item={state.item}
          accent={state.accent}
        />
      </SharePortal>
    </ShareContext.Provider>
  );
};

export const useShareContext = () => {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error('ShareContext missing');
  return ctx;
};
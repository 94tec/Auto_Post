import { motion }   from 'framer-motion';
import { FiClock, FiCheck, FiLoader } from 'react-icons/fi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast }    from 'react-hot-toast';
import { queueApi } from '../utils/queueApi';
import useRole      from '../hooks/useRole';

const QueueButton = ({ item, sourceType = 'quote', variant = 'icon' }) => {
  const { isAdmin } = useRole();
  const qc          = useQueryClient();

  // ── Check server state — survives refresh ──
  
  const { data: queueData } = useQuery({
    queryKey: ['queueList'],
    queryFn:  queueApi.list,  // ← no args passed, list() takes none now
    enabled:  !!isAdmin && !!item?.id,
    staleTime: 30_000,
  });

  const isQueued = (queueData?.items ?? []).some(
    q => q.quoteId === item?.id &&
         (q.status === 'pending' || q.status === 'retry')
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (!item?.id || !item?.text) throw new Error('Quote data not ready');
      return queueApi.add({
        quoteId:  item.id,
        text:     item.text,
        author:   item.author ?? item.artist ?? 'Unknown',
        category: item.category ?? 'general',
      });
    },
    onSuccess: () => {
      toast.success('Added to posting queue');
      qc.invalidateQueries({ queryKey: ['queueList'] });
    },
    onError: (err) => {
      if (err.message?.includes('already in the queue')) {
        toast('Already queued', { icon: '⏳' });
        qc.invalidateQueries({ queryKey: ['queueList'] }); // sync state
      } else {
        toast.error(err.message || 'Failed to queue');
      }
    },
  });

  if (!isAdmin || !item?.id) return null;

  const isLoading = mutation.isPending;
  const done      = isQueued || mutation.isSuccess; // server OR local success

  if (variant === 'icon') {
    return (
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => !done && !isLoading && mutation.mutate()}
        disabled={isLoading || done}
        aria-label={done ? 'Already queued' : 'Add to queue'}
        title={done ? 'Already in queue' : 'Add to posting queue'}
        className="w-8 h-8 rounded-xl flex items-center justify-center border transition-all disabled:cursor-not-allowed"
        style={{
          background:  done ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.10)',
          borderColor: done ? 'rgba(52,211,153,0.25)' : 'rgba(245,158,11,0.25)',
          color:       done ? '#34d399'                : '#F59E0B',
        }}
      >
        {isLoading
          ? <FiLoader size={13} className="animate-spin" />
          : done
          ? <FiCheck  size={13} />
          : <FiClock  size={13} />
        }
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => !done && !isLoading && mutation.mutate()}
      disabled={isLoading || done}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:cursor-not-allowed"
      style={{
        background:  done ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.10)',
        border:      `1px solid ${done ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
        color:       done ? '#34d399' : '#F59E0B',
      }}
    >
      {isLoading ? <FiLoader size={14} className="animate-spin" /> :
       done      ? <FiCheck  size={14} /> :
                   <FiClock  size={14} />}
      {done ? 'Queued' : isLoading ? 'Adding…' : 'Add to Queue'}
    </motion.button>
  );
};

export default QueueButton;
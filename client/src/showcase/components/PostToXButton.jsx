// components/PostToXButton.jsx
import { motion } from 'framer-motion';
import { FiShare2 } from 'react-icons/fi';
import { useShowcaseShare } from '../../hooks/useShowcaseShare';

const PostToXButton = ({
  showcase,
  item,
  type = 'showcase',
}) => {
  const { openShare } = useShowcaseShare();

  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      onClick={() =>
        openShare({
          showcase,
          item,
          type,
        })
      }
      className="w-7 h-7 rounded-xl flex items-center justify-center border border-white/8 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all"
    >
      <FiShare2 size={11} />
    </motion.button>
  );
};

export default PostToXButton;
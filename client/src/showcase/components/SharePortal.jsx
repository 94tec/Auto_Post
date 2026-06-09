import { createPortal } from 'react-dom';

const SharePortal = ({ children }) => createPortal(children, document.body);

export default SharePortal;
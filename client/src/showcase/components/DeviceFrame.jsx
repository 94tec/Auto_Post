const DeviceFrame = ({ children }) => {
  return (
    <div className="relative mx-auto w-[360px] max-w-full">

      <div className="absolute inset-0 blur-[90px] opacity-40 rounded-full bg-white/20 scale-110" />

      <div className="relative rounded-[3rem] border border-white/10 bg-[#0A0E1A] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.6)]">

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[0.05] to-transparent" />

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160px] h-[30px] bg-black rounded-b-3xl z-50" />

        <div className="relative h-[760px] overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DeviceFrame;
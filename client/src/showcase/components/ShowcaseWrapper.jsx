// showcase/components/ShowcaseWrapper.jsx
const ShowcaseWrapper = ({
  hero,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#0A0E1A] py-20 px-6 overflow-hidden">

      <div className="max-w-7xl mx-auto">
        {hero}

        <div className="flex justify-center">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ShowcaseWrapper;
import React from 'react';
import { Link } from 'react-router-dom';
import { PillButton } from '../components/ui/Button';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <span className="font-serif italic text-muted text-lg">(404)</span>
      <h1 className="text-display font-serif font-light text-ink mt-2 mb-4">
        Coordinates Unfound
      </h1>
      <p className="text-muted text-body max-w-md mb-8">
        The requested pathway does not exist within the solar telemetry matrix.
      </p>
      <Link to="/">
        <PillButton variant="primary">Return to Overview</PillButton>
      </Link>
    </div>
  );
};

export default NotFound;


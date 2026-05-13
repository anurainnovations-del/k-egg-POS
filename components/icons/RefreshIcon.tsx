interface RefreshIconProps {
  className?: string;
  isSpinning?: boolean;
}

export default function RefreshIcon({ className = '', isSpinning = false }: RefreshIconProps) {
  return (
    <svg 
      className={`${className} ${isSpinning ? 'animate-spin' : ''}`}
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
    >
      <path 
        d="M21 3V8M21 8H16M21 8L18 5.29C16.9675 3.90175 15.4874 2.89307 13.8158 2.42933C12.1443 1.96559 10.3785 2.07318 8.77412 2.73691C7.16973 3.40064 5.81781 4.58523 4.91975 6.10493C4.02169 7.62464 3.62391 9.39553 3.78398 11.1632C3.94405 12.9308 4.65508 14.6009 5.81045 15.9424C6.96583 17.2838 8.5016 18.2283 10.2179 18.6388C11.9342 19.0494 13.7395 18.9039 15.3818 18.2232C17.0241 17.5426 18.4214 16.3649 19.37 14.85" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
}

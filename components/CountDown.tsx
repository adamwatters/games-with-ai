import React, { useState, useEffect } from 'react';

const CountDown = ({ initialCount, isRunning }) => {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let timer;
    if (isRunning && count > 0) {
      // Update the count every second
      timer = setInterval(() => setCount(count - 1), 1000);
    }

    // Cleanup the interval when the component unmounts or isRunning changes
    return () => clearInterval(timer);
  }, [count, isRunning]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <div>{formatTime(count)}</div>
    </div>
  );
};

export default CountDown;
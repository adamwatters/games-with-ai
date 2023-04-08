import React, { useState, useEffect } from 'react';

const CountDown = ({ time }) => {
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <div>{formatTime(time)}</div>
    </div>
  );
};

export default CountDown;
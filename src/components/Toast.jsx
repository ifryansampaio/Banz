import React from 'react';

const Toast = ({ message, show }) => {
  return (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow-lg transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      {message}
    </div>
  );
};

export default Toast;

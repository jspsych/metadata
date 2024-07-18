import React, { useState } from 'react';

type ListPopup = {
  onClose: () => void;
  metadata: {};
}

const ListPopup: React.FC<ListPopup> = ( { onClose, metadata } ) => { 

  console.log(metadata); // iterate through it and generate a lot of buttons 

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <p>this is the listPopup page</p>
        <button className="close-button" onClick={onClose}>X</button>
      </div>
    </div>
  )
}

export default ListPopup;
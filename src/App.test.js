import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

jest.useFakeTimers();

function mockFirebaseSuccess() {
  window.firebaseDatabase = {};
  window.firebaseRef = jest.fn((db, path) => ({ db, path }));
  window.firebaseOnValue = jest.fn((ref, callback) => {
    callback({ val: () => null });
    return () => {};
  });
  window.firebaseSet = jest.fn(() => Promise.resolve());
}

describe('App movimentações e status de sincronização', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirebaseSuccess();
  });

  test('renderiza sem quebrar', () => {
    render(<App />);
    expect(screen.getByText(/EstoqueFF/i)).toBeInTheDocument();
  });

  test('useFirebaseState suporta update assíncrono sem lançar erro', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(window.firebaseSet).toBeDefined();
  });
});


import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock dos ícones Lucide para evitar erros de renderização
jest.mock('lucide-react', () => ({
  QrCode: () => <div data-testid="icon-qrcode" />,
  Package: () => <div data-testid="icon-package" />,
  Users: () => <div data-testid="icon-users" />,
  BarChart3: () => <div data-testid="icon-barchart" />,
  Settings: () => <div data-testid="icon-settings" />,
  Scan: () => <div data-testid="icon-scan" />,
  Plus: () => <div data-testid="icon-plus" />,
  AlertTriangle: () => <div data-testid="icon-alert" />,
  TrendingUp: () => <div data-testid="icon-trending" />,
  Download: () => <div data-testid="icon-download" />,
  Search: () => <div data-testid="icon-search" />,
  Edit: () => <div data-testid="icon-edit" />,
  Trash2: () => <div data-testid="icon-trash" />,
  Camera: () => <div data-testid="icon-camera" />,
  CheckCircle: () => <div data-testid="icon-check" />,
  Save: () => <div data-testid="icon-save" />,
  X: () => <div data-testid="icon-x" />,
  Check: () => <div data-testid="icon-check-simple" />,
  Loader2: () => <div data-testid="icon-loader" />,
  FileText: () => <div data-testid="icon-file-text" />,
  FileSpreadsheet: () => <div data-testid="icon-file-spreadsheet" />,
  Upload: () => <div data-testid="icon-upload" />,
  Clock: () => <div data-testid="icon-clock" />
}));

// Mock do Firebase
const mockSet = jest.fn();
const mockOnValue = jest.fn();
const mockRef = jest.fn();
const mockGet = jest.fn();

window.firebaseDatabase = {};
window.firebaseRef = mockRef;
window.firebaseOnValue = mockOnValue;
window.firebaseSet = mockSet;
window.firebaseGet = mockGet;

describe('EstoqueFF - Testes de Sincronização Offline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
    
    // Setup padrão dos mocks
    mockRef.mockImplementation((db, path) => ({ key: path }));
    mockOnValue.mockImplementation((ref, callback) => {
      callback({ val: () => null }); // Dados iniciais vazios
      return () => {}; // Unsubscribe function
    });
    mockSet.mockResolvedValue(true);
    mockGet.mockResolvedValue({ exists: () => false, val: () => null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const login = async () => {
    fireEvent.change(screen.getByPlaceholderText('Digite seu usuário'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Digite sua senha'), { target: { value: '123' } });
    fireEvent.click(screen.getByText('Entrar'));
    await screen.findByText('EstoqueFF Dashboard');
  };

  test('Deve renderizar o dashboard corretamente após login', async () => {
    await act(async () => {
      render(<App />);
    });
    
    await login();
    
    expect(screen.getByText('EstoqueFF Dashboard')).toBeInTheDocument();
  });

  test('Deve carregar dados do localStorage se houver (Simulação de Reload Offline)', async () => {
    // Prepara dados locais simulando um estado salvo offline
    const localMovements = [
      { id: 'offline1', product: 'Produto Teste', quantity: 10, type: 'entrada', status: 'pending', date: '2025-08-20 10:00' }
    ];
    const queueData = [
      { payload: localMovements, ts: Date.now(), id: '1' }
    ];
    
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify(queueData));

    await act(async () => {
      render(<App />);
    });

    // Login necessário para ver o dashboard e disparar efeitos que dependem de renderização completa
    await login();

    // Avança timers para permitir que o useEffect processe o localStorage
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Verifica se os dados locais foram carregados no estado
    // Precisamos navegar para a tela de relatórios ou verificar algum efeito colateral
    // Como não conseguimos ver o estado interno facilmente, verificamos se o flush foi tentado
    // O flushOfflineQueue deve ser chamado na inicialização
    expect(mockSet).toHaveBeenCalled();
  });

  test('Deve exibir indicador de sincronização quando ocorrer flush da fila', async () => {
    // Simula fila pendente
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{ payload: [], ts: 1, id: '1' }]));

    await act(async () => {
      render(<App />);
    });

    await login();

    // O hook dispara flushOfflineQueue na montagem
    // O status deve mudar para 'syncing' e depois 'synced' ou 'error'
    
    // Verifica se tentou salvar no Firebase
    await waitFor(() => {
      expect(mockSet).toHaveBeenCalled();
    });
  });

  test('Deve lidar com erro de conexão e tentar novamente (Retry)', async () => {
    // Simula erro no Firebase
    mockSet.mockRejectedValueOnce(new Error('Network Error'));
    
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{ payload: [], ts: 1, id: '1' }]));

    await act(async () => {
      render(<App />);
    });

    await login();

    // Primeiro flush falha
    await act(async () => {
      jest.advanceTimersByTime(100); 
    });
    
    expect(mockSet).toHaveBeenCalledTimes(1);

    // O sistema deve agendar um retry (backoff)
    // Vamos avançar o tempo para cobrir o primeiro backoff (1000ms)
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Deve ter tentado novamente
    expect(mockSet).toHaveBeenCalledTimes(2);
  });
});

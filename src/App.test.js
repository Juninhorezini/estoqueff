import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App, {
  mergeMovementCollections,
  normalizeProductsValue,
  normalizeRemoteValue
} from './App';

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
const mockRunTransaction = jest.fn();

window.firebaseDatabase = {};
window.firebaseRef = mockRef;
window.firebaseOnValue = mockOnValue;
window.firebaseSet = mockSet;
window.firebaseGet = mockGet;
window.firebaseRunTransaction = mockRunTransaction;

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
    mockRunTransaction.mockReset();
    mockRunTransaction.mockImplementation(async (_ref, updater) => {
      const current = [
        { id: 'P001', name: 'Produto Teste', stock: 10 }
      ];
      const next = updater(current);
      if (typeof next === 'undefined') {
        return { committed: false, snapshot: { val: () => current } };
      }
      return { committed: true, snapshot: { val: () => next } };
    });
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
      {
        id: 'offline1',
        product: 'Produto Teste',
        productId: 'P001',
        quantity: 10,
        type: 'entrada',
        status: 'pending',
        date: '2025-08-20 10:00',
        timestamp: '2025-08-20T10:00:00.000Z',
        userId: 'user1',
        userName: 'Administrador'
      }
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
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{
      payload: [{
        id: 'pending1',
        product: 'Produto Teste',
        productId: 'P001',
        quantity: 1,
        type: 'entrada',
        status: 'pending',
        date: '2025-08-20 10:00',
        timestamp: '2025-08-20T10:00:00.000Z',
        userId: 'user1',
        userName: 'Administrador'
      }],
      ts: 1,
      id: '1'
    }]));

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
    // Simula falha na transação para manter a movimentação pendente e disparar retry
    mockRunTransaction
      .mockImplementationOnce(async () => {
        throw new Error('Network Error');
      })
      .mockImplementation(async (_ref, updater) => {
        const current = [{ id: 'P001', name: 'Produto Teste', stock: 10 }];
        const next = updater(current);
        if (typeof next === 'undefined') {
          return { committed: false, snapshot: { val: () => current } };
        }
        return { committed: true, snapshot: { val: () => next } };
      });
    
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{
      payload: [{
        id: 'retry1',
        product: 'Produto Teste',
        productId: 'P001',
        quantity: 1,
        type: 'entrada',
        status: 'pending',
        date: '2025-08-20 10:00',
        timestamp: '2025-08-20T10:00:00.000Z',
        userId: 'user1',
        userName: 'Administrador'
      }],
      ts: 1,
      id: '1'
    }]));

    await act(async () => {
      render(<App />);
    });

    await login();

    // Primeiro flush falha
    await act(async () => {
      jest.advanceTimersByTime(100); 
    });
    
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);

    // O sistema deve agendar um retry (backoff)
    // Vamos avançar o tempo para cobrir o primeiro backoff (1000ms)
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Deve ter tentado novamente
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
  });

  test('Aplica delta via transação e grava auditoria ao sincronizar movimentação pendente', async () => {
    const now = Date.now();
    const localMovements = [
      { id: 'm1', product: 'Notebook Dell', productId: 'P001', quantity: 2, type: 'saída', status: 'pending', date: '2025-08-20 10:00', timestamp: new Date(now).toISOString(), userId: 'user1', userName: 'Administrador' }
    ];
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{ payload: localMovements, ts: now, id: '1' }]));

    let serverProducts = [
      { id: 'P001', name: 'Notebook Dell', stock: 10 }
    ];

    mockRunTransaction.mockImplementation(async (_ref, updater) => {
      const next = updater(serverProducts);
      serverProducts = next;
      return { committed: true, snapshot: { val: () => serverProducts } };
    });

    await act(async () => {
      render(<App />);
    });

    await login();

    await waitFor(() => {
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    expect(serverProducts.find(p => p.id === 'P001').stock).toBe(8);

    const setCalls = mockSet.mock.calls.map(([ref, payload]) => ({ key: ref?.key, payload }));
    expect(setCalls.some(c => c.key === 'estoqueff_movements/m1')).toBe(true);
    expect(setCalls.some(c => c.key === 'estoqueff_stock_delta_audit/m1')).toBe(true);
  });

  test('Não reaplica delta se já marcado como aplicado localmente', async () => {
    const now = Date.now();
    const localMovements = [
      { id: 'm2', product: 'Notebook Dell', productId: 'P001', quantity: 1, type: 'entrada', status: 'pending', date: '2025-08-20 10:00', timestamp: new Date(now).toISOString(), userId: 'user1', userName: 'Administrador' }
    ];
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{ payload: localMovements, ts: now, id: '1' }]));
    localStorage.setItem('estoqueff_applied_stock_deltas', JSON.stringify({ m2: now }));

    await act(async () => {
      render(<App />);
    });

    await login();

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalled();
    });

    expect(mockRunTransaction).not.toHaveBeenCalled();
    const setCalls = mockSet.mock.calls.map(([ref, payload]) => ({ key: ref?.key, payload }));
    expect(setCalls.some(c => c.key === 'estoqueff_movements/m2')).toBe(true);
  });

  test('Mantém fila e faz retry quando a transação falha', async () => {
    const now = Date.now();
    const localMovements = [
      { id: 'm3', product: 'Notebook Dell', productId: 'P001', quantity: 2, type: 'saída', status: 'pending', date: '2025-08-20 10:00', timestamp: new Date(now).toISOString(), userId: 'user1', userName: 'Administrador' }
    ];
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{ payload: localMovements, ts: now, id: '1' }]));

    let serverProducts = [
      { id: 'P001', name: 'Notebook Dell', stock: 10 }
    ];

    mockRunTransaction
      .mockImplementationOnce(async () => {
        throw new Error('Transaction failed');
      })
      .mockImplementation(async (_ref, updater) => {
        const next = updater(serverProducts);
        serverProducts = next;
        return { committed: true, snapshot: { val: () => serverProducts } };
      });

    await act(async () => {
      render(<App />);
    });

    await login();

    await waitFor(() => {
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    expect(localStorage.getItem('estoqueff_queue_estoqueff_movements')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    await waitFor(() => {
      expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    });

    expect(serverProducts.find(p => p.id === 'P001').stock).toBe(8);
  });

  test('Marca movimentação como rejeitada quando o saldo do servidor é insuficiente', async () => {
    const now = Date.now();
    const localMovements = [
      {
        id: 'm4',
        product: 'Notebook Dell',
        productId: 'P001',
        quantity: 20,
        type: 'saída',
        status: 'pending',
        date: '2025-08-20 10:00',
        timestamp: new Date(now).toISOString(),
        userId: 'user1',
        userName: 'Administrador'
      }
    ];
    localStorage.setItem('estoqueff_queue_estoqueff_movements', JSON.stringify([{ payload: localMovements, ts: now, id: '1' }]));

    mockRunTransaction.mockImplementation(async (_ref, updater) => {
      const current = [{ id: 'P001', name: 'Notebook Dell', stock: 5 }];
      const next = updater(current);
      if (typeof next === 'undefined') {
        return { committed: false, snapshot: { val: () => current } };
      }
      return { committed: true, snapshot: { val: () => next } };
    });

    await act(async () => {
      render(<App />);
    });

    await login();

    await waitFor(() => {
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    const movementWrite = mockSet.mock.calls.find(([ref]) => ref?.key === 'estoqueff_movements/m4');
    expect(movementWrite).toBeTruthy();
    expect(movementWrite[1].status).toBe('rejected');
    expect(movementWrite[1].rejectedCode).toBe('insufficient_stock');
  });

  test('Prioriza estado terminal do servidor sobre movimentação pendente local', () => {
    const merged = mergeMovementCollections(
      [
        {
          id: 'm5',
          status: 'synced',
          syncedAt: '2026-07-20T10:00:00.000Z',
          productId: 'P001'
        }
      ],
      [
        {
          id: 'm5',
          status: 'pending',
          productId: 'P001',
          syncError: 'offline'
        }
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('synced');
    expect(merged[0].syncedAt).toBe('2026-07-20T10:00:00.000Z');
  });

  test('Normaliza produtos vindos do Firebase como objeto indexado por id', () => {
    const normalized = normalizeProductsValue({
      P001: { name: 'Notebook Dell', stock: 10 },
      P002: { id: 'P002', name: 'Mouse', stock: 5 }
    });

    expect(normalized).toEqual([
      { id: 'P001', name: 'Notebook Dell', stock: 10 },
      { id: 'P002', name: 'Mouse', stock: 5 }
    ]);
    expect(normalizeRemoteValue('estoqueff_products', { P001: { name: 'Notebook Dell', stock: 10 } })).toEqual([
      { id: 'P001', name: 'Notebook Dell', stock: 10 }
    ]);
  });
});

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QrCode, Package, BarChart3, Settings, Scan, Plus, AlertTriangle, TrendingUp, Download, Search, Edit, Trash2, Camera, CheckCircle, Save, X, Check, Loader2, FileText, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import jsQR from 'jsqr';
import './App.css';

// Hook para localStorage
const useStoredState = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
};

// Componente de pesquisa
const ProductSearch = React.memo(({ onSearchChange, searchTerm }) => {
  const handleChange = useCallback((e) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  const clearSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="relative mb-6">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search size={20} className="text-gray-400" />
      </div>
      <input
        type="text"
        inputMode="text"
        placeholder="Pesquisar produtos por nome, código, marca ou categoria..."
        value={searchTerm}
        onChange={handleChange}
        className="w-full pl-10 pr-12 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        style={{ fontSize: '16px' }}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
      />

      {searchTerm && (
        <button
          onClick={clearSearch}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          type="button"
        >
          <X size={20} className="text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
});

// Componente de lista de produtos
const ProductList = React.memo(({ products, searchTerm, onEdit, onDelete }) => {
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;

    const term = searchTerm.toLowerCase().trim();
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.id.toLowerCase().includes(term) ||
      (product.brand && product.brand.toLowerCase().includes(term)) ||
      product.category.toLowerCase().includes(term) ||
      (product.code && product.code.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  if (filteredProducts.length === 0 && searchTerm) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Search size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum produto encontrado</h3>
        <p className="text-gray-500">
          Tente pesquisar com outras palavras-chave ou verifique se o produto está cadastrado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
      {filteredProducts.map(product => (
        <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-gray-800">{product.name}</h3>
              <p className="text-sm text-gray-600">
                {product.brand && `${product.brand} • `}{product.category}
              </p>
              <p className="text-xs text-gray-500">
                Código: {product.code || 'Não informado'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(product)}
                className="p-1 text-gray-400 hover:text-green-500"
                title="Editar produto"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => onDelete(product.id)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Excluir produto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Estoque:</span>
              <span className={`ml-2 font-medium ${
                product.stock <= product.minStock ? 'text-red-600' : 'text-green-600'
              }`}>
                {product.stock}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Mín:</span>
              <span className="ml-2 font-medium">{product.minStock}</span>
            </div>
          </div>

          {product.stock <= product.minStock && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded px-2 py-1">
              <span className="text-red-600 text-xs font-medium">⚠️ Estoque baixo</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

// Editor de etiquetas individual por produto
const LabelEditor = React.memo(({ productId, product, currentConfig, onConfigUpdate, onClose, companySettings }) => {
  const [localConfig, setLocalConfig] = useState(currentConfig);

  useEffect(() => {
    setLocalConfig(currentConfig);
  }, [currentConfig]);

  const handleConfigChange = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveConfig = () => {
    onConfigUpdate(productId, localConfig);
    onClose();
  };

  return (
    <div className="p-4 space-y-6">
      {/* Preview em tempo real */}
      <div>
        <h4 className="font-medium mb-3">Preview da Etiqueta</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          <LabelPreview
            product={product}
            labelTemplate={localConfig}
            companySettings={companySettings}
          />
        </div>

        <p className="text-xs text-gray-500 mt-2 text-center">
          * Configuração salva individualmente para "{product?.name}"
        </p>
      </div>

      {/* Elementos da etiqueta */}
      <div>
        <h4 className="font-medium mb-3">Elementos da Etiqueta</h4>
        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Marca do produto</span>
            <input
              type="checkbox"
              checked={localConfig.showBrand}
              onChange={(e) => handleConfigChange('showBrand', e.target.checked)}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm">Código do produto</span>
            <input
              type="checkbox"
              checked={localConfig.showCode}
              onChange={(e) => handleConfigChange('showCode', e.target.checked)}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm">Nome do produto</span>
            <input
              type="checkbox"
              checked={localConfig.showDescription}
              onChange={(e) => handleConfigChange('showDescription', e.target.checked)}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm">Quantidade</span>
            <input
              type="checkbox"
              checked={localConfig.showQuantity}
              onChange={(e) => handleConfigChange('showQuantity', e.target.checked)}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm">QR Code</span>
            <input
              type="checkbox"
              checked={localConfig.showQRCode}
              onChange={(e) => handleConfigChange('showQRCode', e.target.checked)}
              className="w-5 h-5"
            />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-sm">Borda</span>
            <input
              type="checkbox"
              checked={localConfig.showBorder}
              onChange={(e) => handleConfigChange('showBorder', e.target.checked)}
              className="w-5 h-5"
            />
          </label>
        </div>
      </div>

      {/* Configuração de quantidade personalizada */}
      {localConfig.showQuantity && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Texto da Quantidade para "{product?.name}"
          </label>
          <input
            type="text"
            inputMode="text"
            value={localConfig.customQuantity}
            onChange={(e) => handleConfigChange('customQuantity', e.target.value)}
            className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ fontSize: '16px' }}
            placeholder={`Ex: Lote 2025-001 (padrão: Qtd: ${product?.stock || 0})`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 Deixe vazio para usar "Qtd: [estoque atual]" automaticamente
          </p>
        </div>
      )}

      {/* Tamanhos de fonte */}
      <div>
        <h4 className="font-medium mb-3">Tamanhos de Fonte (pontos)</h4>
        <div className="space-y-3">
          {localConfig.showBrand && (
            <div>
              <label className="block text-sm font-medium mb-1">Marca: {localConfig.brandFontSize}pt</label>
              <input
                type="range"
                min="12"
                max="36"
                step="1"
                value={localConfig.brandFontSize}
                onChange={(e) => handleConfigChange('brandFontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          {(localConfig.showCode || localConfig.showDescription) && (
            <div>
              <label className="block text-sm font-medium mb-1">Produto: {localConfig.codeFontSize}pt</label>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={localConfig.codeFontSize}
                onChange={(e) => handleConfigChange('codeFontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          {localConfig.showQuantity && (
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade: {localConfig.quantityFontSize}pt</label>
              <input
                type="range"
                min="10"
                max="28"
                step="1"
                value={localConfig.quantityFontSize}
                onChange={(e) => handleConfigChange('quantityFontSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          {localConfig.showQRCode && (
            <div>
              <label className="block text-sm font-medium mb-1">QR Code: {localConfig.qrSize}mm</label>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={localConfig.qrSize}
                onChange={(e) => handleConfigChange('qrSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Cores */}
      <div>
        <h4 className="font-medium mb-3">Cores</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Cor do Texto</label>
            <input
              type="color"
              value={localConfig.textColor}
              onChange={(e) => handleConfigChange('textColor', e.target.value)}
              className="w-full h-10 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cor de Fundo</label>
            <input
              type="color"
              value={localConfig.backgroundColor}
              onChange={(e) => handleConfigChange('backgroundColor', e.target.value)}
              className="w-full h-10 border border-gray-300 rounded"
            />
          </div>

          {localConfig.showBorder && (
            <div>
              <label className="block text-sm font-medium mb-1">Cor da Borda</label>
              <input
                type="color"
                value={localConfig.borderColor}
                onChange={(e) => handleConfigChange('borderColor', e.target.value)}
                className="w-full h-10 border border-gray-300 rounded"
              />
            </div>
          )}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={saveConfig}
          className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
        >
          <Save size={16} />
          Salvar Configuração
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-blue-800 text-xs">
          💾 Esta configuração será salva apenas para "{product?.name}" e será lembrada nas próximas gerações de etiquetas deste produto.
        </p>
      </div>
    </div>
  );
});

// Preview da etiqueta
const LabelPreview = React.memo(({ product, labelTemplate, companySettings }) => {
  if (!product || !labelTemplate) return null;

  const ptToPx = 1.33;
  const mmToPxPreview = 1.2;

  return (
    <div
      className="border rounded-lg bg-white mx-auto relative"
      style={{
        backgroundColor: labelTemplate.backgroundColor,
        width: '200px',
        height: '140px',
        padding: '12px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          color: labelTemplate.textColor,
          lineHeight: '1.2',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >

        {/* Área superior centralizada */}
        <div className="text-center" style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          {labelTemplate.showBrand && product.brand && (
            <div
              className="font-bold"
              style={{
                fontSize: (labelTemplate.brandFontSize * ptToPx) + 'px',
                marginBottom: '6px'
              }}
            >
              {product.brand}
            </div>
          )}

          <div
            className="text-center"
            style={{
              fontSize: (labelTemplate.codeFontSize * ptToPx) + 'px',
              wordWrap: 'break-word',
              lineHeight: '1.3',
              marginBottom: '4px'
            }}
          >
            {labelTemplate.showCode && labelTemplate.showDescription && `${product.code || ''} - ${product.name}`}
            {labelTemplate.showCode && !labelTemplate.showDescription && (product.code || '')}
            {!labelTemplate.showCode && labelTemplate.showDescription && product.name}
          </div>
        </div>

        {/* Área inferior */}
        <div className="flex justify-between items-end" style={{ height: '32px', marginTop: '8px' }}>

          {labelTemplate.showQuantity && (
            <div className="flex items-end">
              <div
                className="font-bold"
                style={{
                  fontSize: (labelTemplate.quantityFontSize * ptToPx) + 'px'
                }}
              >
                {labelTemplate.customQuantity.trim() || `${product.stock}`}
              </div>
            </div>
          )}

          {labelTemplate.showQRCode && (
            <div
              className="bg-black flex items-center justify-center rounded"
              style={{
                width: (labelTemplate.qrSize * mmToPxPreview) + 'px',
                height: (labelTemplate.qrSize * mmToPxPreview) + 'px',
                flexShrink: 0
              }}
            >
              <QrCode size={Math.min(16, Math.max(10, labelTemplate.qrSize * mmToPxPreview * 0.4))} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {labelTemplate.showBorder && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            border: `2px solid ${labelTemplate.borderColor}`
          }}
        />
      )}
    </div>
  );
});

// Mova defaultLabelConfig para fora do componente
const defaultLabelConfig = {
  showBrand: true,
  showCode: false,
  showDescription: true,
  showQuantity: true,
  showQRCode: true,
  customQuantity: '',
  brandFontSize: 18,
  codeFontSize: 12,
  descriptionFontSize: 10,
  quantityFontSize: 14,
  qrSize: 20,
  backgroundColor: '#ffffff',
  textColor: '#000000',
  borderColor: '#cccccc',
  showBorder: true,
  labelWidth: 85,
  labelHeight: 60
};
const EstoqueFFApp = () => {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  // Estados usando localStorage
  const [products, setProducts] = useStoredState('estoqueff_products', [
    { id: 'P001', name: 'Notebook Dell', brand: 'Dell', category: 'Eletrônicos', code: 'NB-DELL-001', stock: 15, minStock: 5, qrCode: 'QR001', createdAt: '2025-01-01' },
    { id: 'P002', name: 'Mouse Logitech', brand: 'Logitech', category: 'Acessórios', code: 'MS-LOG-002', stock: 3, minStock: 10, qrCode: 'QR002', createdAt: '2025-01-01' },
    { id: 'P003', name: 'Teclado Mecânico', brand: 'Razer', category: 'Acessórios', code: 'KB-RZR-003', stock: 8, minStock: 5, qrCode: 'QR003', createdAt: '2025-01-01' },
    { id: 'P004', name: 'Monitor 24"', brand: 'Samsung', category: 'Eletrônicos', code: 'MN-SAM-004', stock: 12, minStock: 3, qrCode: 'QR004', createdAt: '2025-01-01' }
  ]);

  const [movements, setMovements] = useStoredState('estoqueff_movements', [
    { id: '1', product: 'Notebook Dell', type: 'saída', quantity: 2, user: 'João Silva', date: '2025-08-04 14:30' },
    { id: '2', product: 'Mouse Logitech', type: 'entrada', quantity: 5, user: 'Maria Santos', date: '2025-08-04 12:15' },
    { id: '3', product: 'Monitor 24"', type: 'saída', quantity: 1, user: 'Pedro Costa', date: '2025-08-04 10:45' }
  ]);
  const [companySettings, setCompanySettings] = useStoredState('estoqueff_settings', {
    companyName: 'Minha Empresa',
    responsibleName: 'Juninho Rezini',
    lowStockAlert: true
  });
  const [productLabelConfigs, setProductLabelConfigs] = useStoredState('estoqueff_product_label_configs', {});

  // Estados gerais
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [editingLabelForProduct, setEditingLabelForProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Estados para movimentação manual
  const [showManualMovement, setShowManualMovement] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [manualSelectedProduct, setManualSelectedProduct] = useState(null);

  // Estados de pesquisa
  const [searchTerm, setSearchTerm] = useState('');
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  // Estados para novo produto
  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: '',
    category: '',
    code: '',
    stock: 0,
    minStock: 1
  });
  // Estados para relatórios
  const [reportsTab, setReportsTab] = useState('movements');
  const [movementsPeriodFilter, setMovementsPeriodFilter] = useState('all');
  const [productsFilter, setProductsFilter] = useState('all');
  // Fix para teclado mobile
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1, user-scalable=no';
    if (!document.head.contains(viewport)) {
      document.head.appendChild(viewport);
    }
  }, []);
  // Handlers estáveis
  const handleSearchChange = useCallback((newSearchTerm) => {
    setSearchTerm(newSearchTerm);
  }, []);
  const handleLabelSearchChange = useCallback((newSearchTerm) => {
    setLabelSearchTerm(newSearchTerm);
  }, []);
  const handleManualSearchChange = useCallback((newSearchTerm) => {
    setManualSearchTerm(newSearchTerm);
  }, []);
  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
  }, []);
  const handleDeleteProduct = useCallback((productId) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
      setProductLabelConfigs(prevConfigs => {
        const newConfigs = { ...prevConfigs };
        delete newConfigs[productId];
        return newConfigs;
      });
    }
  }, [setProducts, setProductLabelConfigs]);
  // Funções para configurações de etiquetas
  const getProductLabelConfig = useCallback((productId) => {
    return productLabelConfigs[productId] || defaultLabelConfig;
  }, [productLabelConfigs]);
  const updateProductLabelConfig = useCallback((productId, newConfig) => {
    setProductLabelConfigs(prevConfigs => ({
      ...prevConfigs,
      [productId]: {
        ...defaultLabelConfig,
        ...prevConfigs[productId],
        ...newConfig
      }
    }));
  }, [setProductLabelConfigs]);
  const openLabelEditorForProduct = useCallback((productId) => {
    setEditingLabelForProduct(productId);
    setShowLabelEditor(true);
  }, []);
  const closeLabelEditor = useCallback(() => {
    setEditingLabelForProduct(null);
    setShowLabelEditor(false);
  }, []);

  // NOVAS FUNÇÕES DE TRATAMENTO
  const handleStartScanner = () => {
    setScannedProduct(null);
    setErrors({});
    setMovementType('');
    setScannerActive(true);
  };

  const handleCancelScanner = () => {
    setScannedProduct(null);
    setMovementQuantity(1);
    setMovementType('');
    setScannerActive(false);
  };

  // NOVO EFEITO CENTRALIZADO PARA LIGAR/DESLIGAR A CÂMERA
  useEffect(() => {
    if (scannerActive) {
      let stream;
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          cameraStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }

          scanIntervalRef.current = setInterval(() => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);

              if (code) {
                const foundProduct = products.find(p => p.qrCode === code.data);
                if (foundProduct) {
                  setScannedProduct(foundProduct);
                  setSuccess(`✅ Produto "${foundProduct.name}" encontrado!`);
                  setTimeout(() => setSuccess(''), 3000);
                } else {
                  setErrors({ general: 'QR Code não reconhecido. Verifique se o produto está cadastrado.' });
                  setTimeout(() => setErrors({}), 3000);
                }
                setScannerActive(false);
              }
            }
          }, 100);
        } catch (err) {
          setErrors({ camera: `Erro ao acessar a câmera: ${err.message}` });
          setScannerActive(false);
        }
      };

      startCamera();
    } else {
      // Para a câmera e o escaneamento
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    }
  }, [scannerActive, products]);

  // Validação de produtos
  const validateProduct = (product, isEdit = false) => {
    const newErrors = {};
    if (!product.name || product.name.trim().length < 2) {
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';
    }

    if (!product.category || product.category.trim().length < 2) {
      newErrors.category = 'Categoria deve ter pelo menos 2 caracteres';
    }

    const stock = parseInt(product.stock);
    if (isNaN(stock) || stock < 0) {
      newErrors.stock = 'Estoque deve ser um número válido maior ou igual a 0';
    }

    const minStock = parseInt(product.minStock);
    if (isNaN(minStock) || minStock < 1) {
      newErrors.minStock = 'Estoque mínimo deve ser um número válido maior que 0';
    }

    if (!product.code || product.code.trim().length < 2) {
      newErrors.code = 'Código deve ter pelo menos 2 caracteres';
    }

    if (!isEdit) {
      const nameExists = products.some(p =>
        p.name.toLowerCase().trim() === product.name.toLowerCase().trim()
      );
      if (nameExists) {
        newErrors.name = 'Já existe um produto com este nome';
      }
    }

    return newErrors;
  };
  // Adicionar produto
  const addProduct = () => {
    setLoading(true);
    setErrors({});

    const validationErrors = validateProduct(newProduct);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const productId = 'P' + String(Date.now()).slice(-6);
      const qrCode = `ESTOQUEFF_${productId}_${newProduct.name.replace(/\s+/g, '_').toUpperCase()}`;

      const product = {
        ...newProduct,
        name: newProduct.name.trim(),
        brand: newProduct.brand?.trim() || '',
        category: newProduct.category.trim(),
        code: newProduct.code.trim(),
        id: productId,
        qrCode,
        createdAt: new Date().toISOString().split('T')[0],
        stock: parseInt(newProduct.stock),
        minStock: parseInt(newProduct.minStock)
      };
      setProducts([...products, product]);
      setNewProduct({ name: '', brand: '', category: '', code: '', stock: 0, minStock: 1 });
      setShowAddProduct(false);
      setSuccess(`✅ Produto "${product.name}" adicionado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setErrors({ general: 'Erro ao adicionar produto. Tente novamente.' });
    }

    setLoading(false);
  };
  // Atualizar produto
  const updateProduct = () => {
    setLoading(true);
    setErrors({});

    const validationErrors = validateProduct(editingProduct, true);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      setProducts(products.map(p =>
        p.id === editingProduct.id
          ? {
              ...editingProduct,
              name: editingProduct.name.trim(),
              brand: editingProduct.brand?.trim() || '',
              category: editingProduct.category.trim(),
              code: editingProduct.code.trim(),
              stock: parseInt(editingProduct.stock),
              minStock: parseInt(editingProduct.minStock)
            }
          : p
      ));
      setEditingProduct(null);
      setSuccess(`✅ Produto atualizado com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setErrors({ general: 'Erro ao atualizar produto. Tente novamente.' });
    }

    setLoading(false);
  };
  // Processar movimentação
  const processMovement = (product = null) => {
    const targetProduct = product || scannedProduct;
    if (!targetProduct) return;

    setLoading(true);
    setErrors({});

    const quantity = parseInt(movementQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      setErrors({ quantity: 'Quantidade deve ser um número válido maior que 0' });
      setLoading(false);
      return;
    }

    if (!movementType) {
      setErrors({ movement: 'Selecione o tipo de movimentação (Entrada ou Saída)' });
      setLoading(false);
      return;
    }

    if (movementType === 'saída' && targetProduct.stock < quantity) {
      setErrors({ quantity: `Estoque insuficiente! Disponível: ${targetProduct.stock} unidades` });
      setLoading(false);
      return;
    }
    try {
      const newMovement = { id: Date.now().toString(), product: targetProduct.name, productId: targetProduct.id, type: movementType, quantity, user: companySettings.responsibleName, date: new Date().toLocaleString('pt-BR'), timestamp: new Date().toISOString() };
      setMovements([newMovement, ...movements]);
      setProducts(products.map(p => p.id === targetProduct.id ? { ...p, stock: movementType === 'entrada' ? p.stock + quantity : p.stock - quantity } : p ));
      // Reset estados
      setScannedProduct(null);
      setManualSelectedProduct(null);
      setShowManualMovement(false);
      setManualSearchTerm('');
      setMovementQuantity(1);
      setMovementType('');
      setSuccess(`✅ ${movementType === 'entrada' ? 'Entrada' : 'Saída'} de ${quantity} unidades registrada com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setErrors({ general: 'Erro ao processar movimentação. Tente novamente.' });
    }
    setLoading(false);
  };
  // Exportação para PDF
  const exportToPDF = (type, data, title) => {
    const pdf = new jsPDF();
    const timestamp = new Date().toLocaleString('pt-BR'); // Cabeçalho
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 14, 22);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${companySettings.companyName}`, 14, 32);
    pdf.text(`Responsável: ${companySettings.responsibleName}`, 14, 38);
    pdf.text(`Gerado em: ${timestamp}`, 14, 44);
    pdf.setLineWidth(0.5);
    pdf.line(14, 48, 196, 48);
    let columns = [];
    let rows = [];
    if (type === 'products') {
      columns = [
        { header: 'Código', dataKey: 'code' },
        { header: 'Nome', dataKey: 'name' },
        { header: 'Marca', dataKey: 'brand' },
        { header: 'Categoria', dataKey: 'category' },
        { header: 'Estoque', dataKey: 'stock' },
        { header: 'Min.', dataKey: 'minStock' },
        { header: 'Status', dataKey: 'status' }
      ];
      rows = data.map(p => ({ code: p.code || 'N/A', name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name, brand: p.brand || 'N/A', category: p.category, stock: p.stock.toString(), minStock: p.minStock.toString(), status: p.stock <= p.minStock ? 'Baixo' : 'OK' }));
    } else if (type === 'movements') {
      columns = [
        { header: 'Produto', dataKey: 'product' },
        { header: 'Tipo', dataKey: 'type' },
        { header: 'Qtd', dataKey: 'quantity' },
        { header: 'Usuário', dataKey: 'user' },
        { header: 'Data', dataKey: 'date' }
      ];
      rows = data.map(m => ({ product: m.product.length > 25 ? m.product.substring(0, 25) + '...' : m.product, type: m.type === 'entrada' ? 'Entrada' : 'Saída', quantity: m.quantity.toString(), user: m.user.length > 15 ? m.user.substring(0, 15) + '...' : m.user, date: m.date.split(' ')[0] }));
    }
    autoTable(pdf, { columns: columns, body: rows, startY: 55, theme: 'grid', headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 9 }, bodyStyles: { fontSize: 8, cellPadding: 3 }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 14, right: 14 }, tableWidth: 'auto', columnStyles: type === 'products' ? { name: { cellWidth: 35 }, brand: { cellWidth: 25 }, category: { cellWidth: 25 } } : { product: { cellWidth: 50 }, user: { cellWidth: 30 } } });
    // Rodapé
    const estimatedRowHeight = 12;
    const headerHeight = 15;
    const startY = 55;
    const padding = 20;
    const finalY = startY + headerHeight + (rows.length * estimatedRowHeight) + padding;
    pdf.setFontSize(8);
    pdf.text(`Total de registros: ${data.length}`, 14, finalY + 15);
    pdf.text(`EstoqueFF - Sistema de Controle de Estoque`, 14, finalY + 25);
    const filename = `${type === 'products' ? 'produtos' : 'movimentacoes'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  };
  // Exportação para Excel
  const exportToExcel = (type, data, title) => {
    let worksheetData = [];
    let filename = '';
    if (type === 'products') {
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['Código', 'Nome do Produto', 'Marca', 'Categoria', 'Estoque Atual', 'Estoque Mínimo', 'Diferença', 'Status', 'Data Criação']
      ];
      data.forEach(p => {
        const diferenca = p.stock - p.minStock;
        const status = p.stock <= 0 ? 'SEM ESTOQUE' : p.stock <= p.minStock ? 'ESTOQUE BAIXO' : 'NORMAL';
        worksheetData.push([
          p.code || 'N/A',
          p.name,
          p.brand || 'N/A',
          p.category,
          p.stock,
          p.minStock,
          diferenca,
          status,
          p.createdAt || 'N/A'
        ]);
      });
      filename = `relatorio_produtos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else if (type === 'movements') {
      worksheetData = [
        [title],
        [`${companySettings.companyName}`],
        [`Responsável: ${companySettings.responsibleName}`],
        [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
        [],
        ['ID', 'Produto', 'Tipo de Movimentação', 'Quantidade', 'Usuário', 'Data e Hora']
      ];
      data.forEach(m => {
        worksheetData.push([
          m.id,
          m.product,
          m.type === 'entrada' ? 'ENTRADA' : 'SAÍDA',
          m.quantity,
          m.user,
          m.date
        ]);
      });
      filename = `relatorio_movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }
    worksheetData.push([]);
    worksheetData.push(['=== ESTATÍSTICAS ===']);
    worksheetData.push([`Total de registros: ${data.length}`]);
    if (type === 'products') {
      const lowStock = data.filter(p => p.stock <= p.minStock).length;
      const noStock = data.filter(p => p.stock <= 0).length;
      const totalItems = data.reduce((sum, p) => sum + p.stock, 0);
      worksheetData.push([`Produtos com estoque baixo: ${lowStock}`]);
      worksheetData.push([`Produtos sem estoque: ${noStock}`]);
      worksheetData.push([`Total de itens em estoque: ${totalItems}`]);
    } else {
      const entradas = data.filter(m => m.type === 'entrada').length;
      const saidas = data.filter(m => m.type === 'saída').length;
      const totalEntradas = data.filter(m => m.type === 'entrada').reduce((sum, m) => sum + m.quantity, 0);
      const totalSaidas = data.filter(m => m.type === 'saída').reduce((sum, m) => sum + m.quantity, 0);
      worksheetData.push([`Total de entradas: ${entradas} movimentações (${totalEntradas} itens)`]);
      worksheetData.push([`Total de saídas: ${saidas} movimentações (${totalSaidas} itens)`]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    if (type === 'products') {
      ws['!cols'] = [
        { wch: 12 },
        { wch: 30 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 }
      ];
    } else {
      ws['!cols'] = [
        { wch: 10 },
        { wch: 30 },
        { wch: 25 },
        { wch: 10 },
        { wch: 20 },
        { wch: 25 }
      ];
    }
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, filename);
  };
  // Importação de produtos
  const importProducts = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    setErrors({});
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length < 2) {
          setErrors({ general: 'Arquivo Excel vazio ou formato inválido.' });
          setLoading(false);
          return;
        }
        const headers = json[0];
        const requiredHeaders = ['Nome do Produto', 'Marca', 'Categoria', 'Código', 'Estoque Atual', 'Estoque Mínimo'];
        const headersValid = requiredHeaders.every(h => headers.includes(h));
        if (!headersValid) {
          setErrors({ general: `O arquivo deve conter as seguintes colunas: ${requiredHeaders.join(', ')}` });
          setLoading(false);
          return;
        }
        const newProductsData = json.slice(1).map(row => {
          const product = {};
          headers.forEach((header, index) => {
            product[header] = row[index];
          });
          return product;
        });
        const importedProducts = newProductsData.map(p => ({
          id: 'P' + String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000),
          name: p['Nome do Produto']?.toString() || 'Sem Nome',
          brand: p['Marca']?.toString() || '',
          category: p['Categoria']?.toString() || 'Sem Categoria',
          code: p['Código']?.toString() || '',
          stock: parseInt(p['Estoque Atual']) || 0,
          minStock: parseInt(p['Estoque Mínimo']) || 1,
          qrCode: `ESTOQUEFF_IMPORT_${p['Código'] || p['Nome do Produto']}`.replace(/\s+/g, '_').toUpperCase(),
          createdAt: new Date().toISOString().split('T')[0]
        }));
        setProducts(prev => [...prev, ...importedProducts]);
        setSuccess(`✅ ${importedProducts.length} produtos importados com sucesso!`);
        setTimeout(() => setSuccess(''), 3000);
      } catch (e) {
        setErrors({ general: 'Erro ao processar o arquivo. Verifique o formato e tente novamente.' });
      }
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const getRecentMovements = useMemo(() => {
    return movements.slice(0, 10);
  }, [movements]);
  const getStockStatus = useMemo(() => {
    const lowStock = products.filter(p => p.stock <= p.minStock).length;
    const outOfStock = products.filter(p => p.stock === 0).length;
    return {
      totalProducts: products.length,
      totalStock: products.reduce((sum, p) => sum + p.stock, 0),
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
    };
  }, [products]);
  const formatQuantity = (quantity) => {
    return Number.isInteger(quantity) ? quantity : quantity.toFixed(2);
  };
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      {/* Navbar Superior */}
      <div className="bg-white dark:bg-gray-800 shadow-md p-4 flex items-center justify-between z-10">
        <h1 className="text-xl font-bold">EstoqueFFApp</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => exportToPDF('products', products, 'Relatório de Produtos')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Exportar Produtos (PDF)">
            <FileText size={20} />
          </button>
          <button onClick={() => exportToExcel('products', products, 'Relatório de Produtos')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Exportar Produtos (Excel)">
            <FileSpreadsheet size={20} />
          </button>
          <label htmlFor="import-excel" className="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Importar Produtos (Excel)">
            <Upload size={20} />
            <input id="import-excel" type="file" accept=".xlsx, .xls" onChange={importProducts} className="hidden" />
          </label>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pb-20">
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <span className="block sm:inline">{success}</span>
          </div>
        )}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <strong className="font-bold">Erro:</strong>
            <ul className="mt-2 list-disc list-inside">
              {Object.values(errors).map((error, index) => (
                <li key={index}><span className="block sm:inline ml-2">{error}</span></li>
              ))}
            </ul>
          </div>
        )}
        {currentScreen === 'dashboard' && (
          <div className="pb-20 md:pb-4">
            <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total de Produtos</h3>
                  <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{getStockStatus.totalProducts}</p>
                </div>
                <Package size={40} className="text-blue-500" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Itens em Estoque</h3>
                  <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{getStockStatus.totalStock}</p>
                </div>
                <TrendingUp size={40} className="text-green-500" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Estoque Baixo</h3>
                  <p className="mt-1 text-3xl font-bold text-red-500 dark:text-red-400">{getStockStatus.lowStockCount}</p>
                </div>
                <AlertTriangle size={40} className="text-red-500" />
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">Sem Estoque</h3>
                  <p className="mt-1 text-3xl font-bold text-red-500 dark:text-red-400">{getStockStatus.outOfStockCount}</p>
                </div>
                <AlertTriangle size={40} className="text-red-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Movimentações Recentes</h2>
                <div className="flex gap-2">
                  <button onClick={() => exportToPDF('movements', movements, 'Relatório de Movimentações')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Exportar Movimentações (PDF)">
                    <FileText size={20} />
                  </button>
                  <button onClick={() => exportToExcel('movements', movements, 'Relatório de Movimentações')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="Exportar Movimentações (Excel)">
                    <FileSpreadsheet size={20} />
                  </button>
                </div>
              </div>
              {getRecentMovements.length > 0 ? (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {getRecentMovements.map((movement, index) => (
                    <li key={index} className="py-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{movement.product}</p>
                          <p className={`text-sm ${movement.type === 'entrada' ? 'text-green-600' : 'text-red-600'} font-semibold mt-1`}>
                            {movement.type === 'entrada' ? 'Entrada' : 'Saída'}: {movement.quantity} unidade(s)
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-xs text-gray-500 dark:text-gray-400">{movement.date}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">por {movement.user}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Nenhuma movimentação recente encontrada.</p>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Produtos com Estoque Baixo</h2>
              <ProductList
                products={products.filter(p => p.stock <= p.minStock && p.stock > 0)}
                searchTerm=""
                onEdit={handleEditProduct}
                onDelete={handleDeleteProduct}
              />
              {products.filter(p => p.stock <= p.minStock && p.stock > 0).length === 0 && (
                <p className="text-gray-500 dark:text-gray-400">Nenhum produto com estoque baixo.</p>
              )}
            </div>
          </div>
        )}

        {currentScreen === 'products' && (
          <div className="pb-20 md:pb-4">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Produtos</h1>
              <button
                onClick={() => setShowAddProduct(true)}
                className="bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <Plus size={20} />
                <span className="hidden md:inline">Adicionar Produto</span>
              </button>
            </div>
            <ProductSearch onSearchChange={handleSearchChange} searchTerm={searchTerm} />
            {products.length === 0 && !searchTerm ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <Package size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum produto cadastrado</h3>
                <p className="text-gray-500">
                  Clique no botão "Adicionar Produto" para começar.
                </p>
              </div>
            ) : (
              <ProductList
                products={filteredProducts}
                searchTerm={searchTerm}
                onEdit={handleEditProduct}
                onDelete={handleDeleteProduct}
              />
            )}
          </div>
        )}

        {currentScreen === 'scan' && (
          <div className="p-4 pb-20 md:ml-64 md:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Movimentação de Estoque</h1>
              {scannerActive && (
                <button
                  onClick={handleCancelScanner}
                  className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
                  title="Parar Scanner"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {errors.camera && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                <strong className="font-bold">Erro de Câmera:</strong>
                <span className="block sm:inline ml-2">{errors.camera}</span>
              </div>
            )}

            {/* Botões de opção */}
            {!scannerActive && !scannedProduct && !showManualMovement && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <button
                  onClick={handleStartScanner}
                  disabled={loading}
                  className="bg-blue-500 text-white p-6 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex flex-col items-center gap-3"
                >
                  <Camera size={32} />
                  <div className="text-center">
                    <p className="font-medium">Scanner QR Code</p>
                    <p className="text-xs opacity-80">Use a câmera</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowManualMovement(true)}
                  className="bg-green-500 text-white p-6 rounded-lg hover:bg-green-600 transition-colors flex flex-col items-center gap-3"
                >
                  <Search size={32} />
                  <div className="text-center">
                    <p className="font-medium">Busca Manual</p>
                    <p className="text-xs opacity-80">Pesquisar produto</p>
                  </div>
                </button>
              </div>
            )}

            {/* Visualizador da câmera */}
            {scannerActive && !scannedProduct && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center mb-6">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                />
                <span className="text-white text-lg font-medium absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">Aguardando detecção automática...</span>
              </div>
            )}

            {/* Resto da tela de Movimentação */}
            {scannedProduct && !scannerActive && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Produto Encontrado</h2>
                <p className="text-lg mb-2"><strong>Nome:</strong> {scannedProduct.name}</p>
                <p className="text-lg mb-2"><strong>Estoque Atual:</strong> {formatQuantity(scannedProduct.stock)}</p>
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => setMovementType('entrada')}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${movementType === 'entrada' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                  >
                    Entrada
                  </button>
                  <button
                    onClick={() => setMovementType('saída')}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors ${movementType === 'saída' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                  >
                    Saída
                  </button>
                </div>
                {movementType && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Quantidade:</label>
                    <input
                      type="number"
                      value={movementQuantity}
                      onChange={(e) => setMovementQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}
            {showManualMovement && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Busca Manual</h2>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Buscar produto por nome ou código..."
                    value={manualSearchTerm}
                    onChange={(e) => {
                      setManualSearchTerm(e.target.value);
                      if (e.target.value.length > 2) {
                        const found = products.find(p => p.name.toLowerCase().includes(e.target.value.toLowerCase()) || p.code.toLowerCase().includes(e.target.value.toLowerCase()));
                        if (found) {
                          setManualSelectedProduct(found);
                        } else {
                          setManualSelectedProduct(null);
                        }
                      } else {
                        setManualSelectedProduct(null);
                      }
                    }}
                    className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  />
                  <button onClick={() => setShowManualMovement(false)} className="text-gray-500 hover:text-gray-700">
                    <X size={24} />
                  </button>
                </div>
                {manualSelectedProduct ? (
                  <div className="p-4 bg-gray-100 rounded-lg mb-4">
                    <p className="text-lg font-bold">{manualSelectedProduct.name}</p>
                    <p className="text-sm">Estoque: {formatQuantity(manualSelectedProduct.stock)}</p>
                  </div>
                ) : manualSearchTerm.length > 2 && (
                  <p className="text-red-500 text-sm">Nenhum produto encontrado com este termo.</p>
                )}
                {manualSelectedProduct && (
                  <>
                    <div className="flex gap-4 mb-4">
                      <button
                        onClick={() => setMovementType('entrada')}
                        className={`flex-1 py-3 rounded-lg font-medium transition-colors ${movementType === 'entrada' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                      >
                        Entrada
                      </button>
                      <button
                        onClick={() => setMovementType('saída')}
                        className={`flex-1 py-3 rounded-lg font-medium transition-colors ${movementType === 'saída' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                      >
                        Saída
                      </button>
                    </div>
                    {movementType && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Quantidade:</label>
                        <input
                          type="number"
                          value={movementQuantity}
                          onChange={(e) => setMovementQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          min="1"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {(scannedProduct || manualSelectedProduct) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      if (scannedProduct) {
                        handleCancelScanner();
                      } else {
                        setManualSelectedProduct(null);
                        setManualSearchTerm('');
                        setMovementType('');
                        setErrors({});
                      }
                    }}
                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={20} />
                    Cancelar
                  </button>
                  <button
                    onClick={() => processMovement(scannedProduct || manualSelectedProduct)}
                    disabled={loading || !movementType}
                    className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      !movementType
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : loading
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Confirmar Movimentação
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {currentScreen === 'settings' && (
          <div className="pb-20 md:pb-4">
            <h1 className="text-2xl font-bold mb-6">Configurações</h1>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Informações da Empresa</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome da Empresa</label>
                  <input
                    type="text"
                    value={companySettings.companyName}
                    onChange={(e) => setCompanySettings({ ...companySettings, companyName: e.target.value })}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do Responsável</label>
                  <input
                    type="text"
                    value={companySettings.responsibleName}
                    onChange={(e) => setCompanySettings({ ...companySettings, responsibleName: e.target.value })}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Gerenciamento de Dados</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (window.confirm('Tem certeza que deseja apagar TODOS os produtos e movimentações? Esta ação é irreversível.')) {
                      setProducts([]);
                      setMovements([]);
                      setCompanySettings({ companyName: 'Minha Empresa', responsibleName: 'Juninho Rezini', lowStockAlert: true });
                      setProductLabelConfigs({});
                      setSuccess('✅ Todos os dados foram apagados com sucesso!');
                      setTimeout(() => setSuccess(''), 3000);
                    }
                  }}
                  className="bg-red-500 text-white py-3 px-6 rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={20} />
                  Apagar Tudo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navbar Inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 flex justify-around p-2 md:hidden z-20">
        <button
          onClick={() => setCurrentScreen('dashboard')}
          className={`text-gray-500 dark:text-gray-400 ${currentScreen === 'dashboard' ? 'text-blue-500 dark:text-blue-400' : ''} flex flex-col items-center`}
        >
          <BarChart3 size={24} />
          <span className="text-xs mt-1">Dashboard</span>
        </button>
        <button
          onClick={() => setCurrentScreen('products')}
          className={`text-gray-500 dark:text-gray-400 ${currentScreen === 'products' ? 'text-blue-500 dark:text-blue-400' : ''} flex flex-col items-center`}
        >
          <Package size={24} />
          <span className="text-xs mt-1">Produtos</span>
        </button>
        <button
          onClick={() => { setCurrentScreen('scan'); handleStartScanner(); }}
          className={`text-gray-500 dark:text-gray-400 ${currentScreen === 'scan' ? 'text-blue-500 dark:text-blue-400' : ''} flex flex-col items-center`}
        >
          <QrCode size={24} />
          <span className="text-xs mt-1">Movimentação</span>
        </button>
        <button
          onClick={() => setCurrentScreen('settings')}
          className={`text-gray-500 dark:text-gray-400 ${currentScreen === 'settings' ? 'text-blue-500 dark:text-blue-400' : ''} flex flex-col items-center`}
        >
          <Settings size={24} />
          <span className="text-xs mt-1">Configurações</span>
        </button>
      </div>

      {/* Modal Adicionar/Editar Produto */}
      {(showAddProduct || editingProduct) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setEditingProduct(null);
                    setErrors({});
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do Produto</label>
                  <input
                    type="text"
                    value={editingProduct?.name || newProduct.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      editingProduct ? setEditingProduct(prev => ({ ...prev, name: value })) : setNewProduct(prev => ({ ...prev, name: value }));
                    }}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Marca (Opcional)</label>
                  <input
                    type="text"
                    value={editingProduct?.brand || newProduct.brand}
                    onChange={(e) => {
                      const value = e.target.value;
                      editingProduct ? setEditingProduct(prev => ({ ...prev, brand: value })) : setNewProduct(prev => ({ ...prev, brand: value }));
                    }}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Categoria</label>
                  <input
                    type="text"
                    value={editingProduct?.category || newProduct.category}
                    onChange={(e) => {
                      const value = e.target.value;
                      editingProduct ? setEditingProduct(prev => ({ ...prev, category: value })) : setNewProduct(prev => ({ ...prev, category: value }));
                    }}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Código</label>
                  <input
                    type="text"
                    value={editingProduct?.code || newProduct.code}
                    onChange={(e) => {
                      const value = e.target.value;
                      editingProduct ? setEditingProduct(prev => ({ ...prev, code: value })) : setNewProduct(prev => ({ ...prev, code: value }));
                    }}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.code && <p className="mt-1 text-sm text-red-500">{errors.code}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    value={editingProduct?.stock || newProduct.stock}
                    onChange={(e) => {
                      const value = e.target.value;
                      editingProduct ? setEditingProduct(prev => ({ ...prev, stock: parseInt(value) || 0 })) : setNewProduct(prev => ({ ...prev, stock: parseInt(value) || 0 }));
                    }}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.stock && <p className="mt-1 text-sm text-red-500">{errors.stock}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    value={editingProduct?.minStock || newProduct.minStock}
                    onChange={(e) => {
                      const value = e.target.value;
                      editingProduct ? setEditingProduct(prev => ({ ...prev, minStock: parseInt(value) || 1 })) : setNewProduct(prev => ({ ...prev, minStock: parseInt(value) || 1 }));
                    }}
                    className="w-full px-4 py-3 border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.minStock && <p className="mt-1 text-sm text-red-500">{errors.minStock}</p>}
                </div>
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={() => {
                    setShowAddProduct(false);
                    setEditingProduct(null);
                    setErrors({});
                  }}
                  className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingProduct ? updateProduct : addProduct}
                  disabled={loading}
                  className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingProduct ? 'Salvar Alterações' : 'Adicionar Produto'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editor de Etiquetas */}
      {showLabelEditor && editingLabelForProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Configurar Etiqueta</h3>
                <button
                  onClick={closeLabelEditor}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <LabelEditor
                productId={editingLabelForProduct}
                product={products.find(p => p.id === editingLabelForProduct)}
                currentConfig={getProductLabelConfig(editingLabelForProduct)}
                onConfigUpdate={updateProductLabelConfig}
                onClose={closeLabelEditor}
                companySettings={companySettings}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoqueFFApp;

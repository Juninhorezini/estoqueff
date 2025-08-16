// Parte 1 de 8: Imports, useStoredState, e ProductSearch
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

// Parte 2 de 8: Componente ProductList
const ProductList = React.memo(({ products, onEdit, onDelete, onSelectProduct }) => {
  return (
    <div className="space-y-4">
      {products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Package size={48} className="mx-auto mb-2 text-gray-400" />
          <p>Nenhum produto encontrado.</p>
        </div>
      ) : (
        products.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            onClick={() => onSelectProduct(product)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectProduct(product)}
          >
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <p className="text-sm text-gray-500">Código: {product.id} | QR: {product.qrCode || 'N/A'}</p>
                  <p className="text-sm text-gray-500">Marca: {product.brand || 'N/A'} | Categoria: {product.category || 'N/A'}</p>
                  <p className="text-sm text-gray-500">Estoque: {product.quantity} | Preço: R${parseFloat(product.price).toFixed(2)}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(product);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                    title="Editar produto"
                    type="button"
                  >
                    <Edit size={20} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(product.id);
                    }}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                    title="Excluir produto"
                    type="button"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
});

// Parte 3 de 8: Componentes LabelEditor e LabelPreview
const LabelEditor = React.memo(({ labelConfig, setLabelConfig, onSave }) => {
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setLabelConfig((prev) => ({ ...prev, [name]: value }));
  }, [setLabelConfig]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Configuração da Etiqueta</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700">Tamanho da Etiqueta (mm)</label>
        <div className="flex space-x-2">
          <input
            type="number"
            name="width"
            value={labelConfig.width}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-lg"
            placeholder="Largura"
            min="1"
          />
          <input
            type="number"
            name="height"
            value={labelConfig.height}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-lg"
            placeholder="Altura"
            min="1"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Margens (mm)</label>
        <div className="flex space-x-2">
          <input
            type="number"
            name="marginTop"
            value={labelConfig.marginTop}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-lg"
            placeholder="Margem Superior"
            min="0"
          />
          <input
            type="number"
            name="marginLeft"
            value={labelConfig.marginLeft}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-lg"
            placeholder="Margem Esquerda"
            min="0"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Tamanho da Fonte</label>
        <input
          type="number"
          name="fontSize"
          value={labelConfig.fontSize}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="Tamanho da Fonte"
          min="1"
        />
      </div>
      <button
        onClick={onSave}
        className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
        type="button"
      >
        <Save size={20} className="mr-2" />
        Salvar Configuração
      </button>
    </div>
  );
});

const LabelPreview = React.memo(({ product, labelConfig }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !product) return;

    const ctx = canvas.getContext('2d');
    const { width, height, marginTop, marginLeft, fontSize } = labelConfig;

    canvas.width = width * 3.78;
    canvas.height = height * 3.78;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(product.name, marginLeft * 3.78, marginTop * 3.78 + fontSize);
    ctx.fillText(`Cód: ${product.id}`, marginLeft * 3.78, marginTop * 3.78 + fontSize * 2);
    ctx.fillText(`Preço: R$${parseFloat(product.price).toFixed(2)}`, marginLeft * 3.78, marginTop * 3.78 + fontSize * 3);

    if (product.qrCode) {
      const qrCanvas = document.createElement('canvas');
      const qrCode = new window.QRCode(qrCanvas, {
        text: product.qrCode,
        width: fontSize * 5,
        height: fontSize * 5,
      });
      setTimeout(() => {
        ctx.drawImage(qrCanvas, marginLeft * 3.78, marginTop * 3.78 + fontSize * 4);
      }, 100);
    }
  }, [product, labelConfig]);

  return <canvas ref={canvasRef} className="border border-gray-300" />;
});

// Parte 4 de 8: Configuração padrão de etiquetas e início do componente EstoqueFFApp
const defaultLabelConfig = {
  width: 50,
  height: 30,
  marginTop: 5,
  marginLeft: 5,
  fontSize: 12,
};

const EstoqueFFApp = () => {
  const [products, setProducts] = useStoredState('products', []);
  const [movements, setMovements] = useStoredState('movements', []);
  const [labelConfig, setLabelConfig] = useStoredState('labelConfig', defaultLabelConfig);
  const [companySettings, setCompanySettings] = useStoredState('companySettings', {
    name: '',
    logo: '',
    contact: '',
  });
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.id.toLowerCase().includes(term) ||
        (product.brand && product.brand.toLowerCase().includes(term)) ||
        (product.category && product.category.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleScreenChange = useCallback((screen) => {
    setCurrentScreen(screen);
    setIsSidebarOpen(false);
    setSearchTerm('');
    setSelectedProduct(null);
    setEditingProduct(null);
    setMovementType('');
    setMovementQuantity('');
    setMovementDescription('');
    setErrors({});
    stopCamera();
  }, []);

  const handleSelectProduct = useCallback((product) => {
    setSelectedProduct(product);
    setCurrentScreen('productDetails');
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setErrors({});
  }, []);

 // Parte 5 de 8: Funções de scanner (startRealQRScanner, stopCamera, findProductByQR) e useEffect de cleanup
const startRealQRScanner = async () => {
  try {
    setLoading(true);
    setScannerActive(true);
    setErrors({});
    setMovementType('');
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    setCameraStream(stream);
    
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Video play interrupted:', error.message);
        });
      }
    }
    
    setLoading(false);
    
    // Função para escanear QR code em tempo real
    const scanQR = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        canvasRef.current.height = videoRef.current.videoHeight;
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.getContext('2d').drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const imageData = canvasRef.current.getContext('2d').getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          const foundProduct = findProductByQR(code.data);
          if (foundProduct) {
            setScannedProduct(foundProduct);
            stopCamera();
            setSuccess(`✅ Produto "${foundProduct.name}" encontrado!`);
            setTimeout(() => setSuccess(''), 3000);
          } else {
            setErrors({ general: 'QR Code não reconhecido. Verifique se o produto está cadastrado.' });
            setTimeout(() => setErrors({}), 3000);
          }
        }
      }
      if (scannerActive) {
        requestAnimationFrame(scanQR);
      }
    };

    requestAnimationFrame(scanQR);
    
  } catch (error) {
    console.error('Erro ao acessar câmera:', error);
    setErrors({ camera: 'Não foi possível acessar a câmera. Verifique as permissões.' });
    setScannerActive(false);
    setLoading(false);
  }
};

const stopCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    setCameraStream(null);
  }
  setScannerActive(false);
  if (videoRef.current) {
    videoRef.current.pause();
    videoRef.current.srcObject = null;
  }
};

const findProductByQR = (qrCode) => {
  return products.find(p => p.qrCode === qrCode || p.id === qrCode);
};

useEffect(() => {
  return () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  };
}, [cameraStream]);

const validateProduct = (product) => {
  const newErrors = {};
  if (!product.name) newErrors.name = 'Nome do produto é obrigatório';
  if (!product.id) newErrors.id = 'Código do produto é obrigatório';
  if (!product.quantity || product.quantity < 0) newErrors.quantity = 'Quantidade deve ser maior ou igual a 0';
  if (!product.price || product.price <= 0) newErrors.price = 'Preço deve ser maior que 0';
  return newErrors;
};

// Parte 6 de 8: Funções de gerenciamento de produtos
const addProduct = (product) => {
  const validationErrors = validateProduct(product);
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }
  setProducts((prev) => [...prev, { ...product, qrCode: product.qrCode || product.id }]);
  setSuccess('✅ Produto adicionado com sucesso!');
  setTimeout(() => setSuccess(''), 3000);
  closeModal();
};

const updateProduct = (updatedProduct) => {
  const validationErrors = validateProduct(updatedProduct);
  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }
  setProducts((prev) =>
    prev.map((p) => (p.id === updatedProduct.id ? { ...updatedProduct, qrCode: updatedProduct.qrCode || updatedProduct.id } : p))
  );
  setSuccess('✅ Produto atualizado com sucesso!');
  setTimeout(() => setSuccess(''), 3000);
  closeModal();
};

const deleteProduct = (id) => {
  setProducts((prev) => prev.filter((p) => p.id !== id));
  setSuccess('✅ Produto excluído com sucesso!');
  setTimeout(() => setSuccess(''), 3000);
  setSelectedProduct(null);
  setCurrentScreen('products');
};

const handleMovement = () => {
  if (!scannedProduct && !selectedProduct) {
    setErrors({ general: 'Selecione um produto primeiro' });
    return;
  }
  if (!movementType) {
    setErrors({ movementType: 'Selecione o tipo de movimentação' });
    return;
  }
  if (!movementQuantity || movementQuantity <= 0) {
    setErrors({ movementQuantity: 'Quantidade deve ser maior que 0' });
    return;
  }

  const product = scannedProduct || selectedProduct;
  const newQuantity = movementType === 'entrada'
    ? product.quantity + parseInt(movementQuantity)
    : product.quantity - parseInt(movementQuantity);

  if (newQuantity < 0) {
    setErrors({ movementQuantity: 'Estoque não pode ser negativo' });
    return;
  }

  setProducts((prev) =>
    prev.map((p) =>
      p.id === product.id ? { ...p, quantity: newQuantity } : p
    )
  );

  setMovements((prev) => [
    ...prev,
    {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      type: movementType,
      quantity: parseInt(movementQuantity),
      description: movementDescription,
      date: new Date().toISOString(),
    },
  ]);

  setSuccess(`✅ Movimentação de ${movementType} registrada!`);
  setTimeout(() => setSuccess(''), 3000);
  setMovementType('');
  setMovementQuantity('');
  setMovementDescription('');
  setScannedProduct(null);
  setSelectedProduct(null);
  setCurrentScreen('products');
};

const generateLabel = (product) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [labelConfig.width, labelConfig.height],
  });

  doc.setFontSize(labelConfig.fontSize);
  doc.text(product.name, labelConfig.marginLeft, labelConfig.marginTop + labelConfig.fontSize);
  doc.text(`Cód: ${product.id}`, labelConfig.marginLeft, labelConfig.marginTop + labelConfig.fontSize * 2);
  doc.text(`Preço: R$${parseFloat(product.price).toFixed(2)}`, labelConfig.marginLeft, labelConfig.marginTop + labelConfig.fontSize * 3);

  if (product.qrCode) {
    const qrCanvas = document.createElement('canvas');
    new window.QRCode(qrCanvas, {
      text: product.qrCode,
      width: labelConfig.fontSize * 5,
      height: labelConfig.fontSize * 5,
    });
    setTimeout(() => {
      doc.addImage(qrCanvas, 'PNG', labelConfig.marginLeft, labelConfig.marginTop + labelConfig.fontSize * 4);
      doc.save(`${product.id}_etiqueta.pdf`);
    }, 100);
  } else {
    doc.save(`${product.id}_etiqueta.pdf`);
  }
};

const exportToPDF = () => {
  const doc = new jsPDF();
  doc.text('Relatório de Estoque', 20, 20);
  if (companySettings.name) {
    doc.text(`Empresa: ${companySettings.name}`, 20, 30);
  }

  autoTable(doc, {
    startY: 40,
    head: [['Código', 'Nome', 'Marca', 'Categoria', 'Quantidade', 'Preço']],
    body: products.map((p) => [
      p.id,
      p.name,
      p.brand || 'N/A',
      p.category || 'N/A',
      p.quantity,
      `R$${parseFloat(p.price).toFixed(2)}`,
    ]),
  });

  doc.save('relatorio_estoque.pdf');
};

const exportToExcel = () => {
  const worksheet = XLSX.utils.json_to_sheet(
    products.map((p) => ({
      Código: p.id,
      Nome: p.name,
      Marca: p.brand || 'N/A',
      Categoria: p.category || 'N/A',
      Quantidade: p.quantity,
      Preço: `R$${parseFloat(p.price).toFixed(2)}`,
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque');
  XLSX.write_file(workbook, 'relatorio_estoque.xlsx');
};

// Parte 7 de 8: JSX do componente principal (telas de dashboard, produtos, scanner, detalhes)
return (
  <div className="min-h-screen bg-gray-100 flex">
    {/* Sidebar */}
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 transition-transform duration-300 ease-in-out md:relative md:shadow-none`}
    >
      <div className="p-4">
        <h1 className="text-2xl font-bold text-blue-600">EstoqueFF</h1>
        {companySettings.name && (
          <p className="text-sm text-gray-500">{companySettings.name}</p>
        )}
      </div>
      <nav className="mt-4">
        <button
          onClick={() => handleScreenChange('dashboard')}
          className={`w-full flex items-center p-4 text-left ${
            currentScreen === 'dashboard' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          } hover:bg-blue-50`}
          type="button"
        >
          <BarChart3 size={20} className="mr-2" /> Dashboard
        </button>
        <button
          onClick={() => handleScreenChange('products')}
          className={`w-full flex items-center p-4 text-left ${
            currentScreen === 'products' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          } hover:bg-blue-50`}
          type="button"
        >
          <Package size={20} className="mr-2" /> Produtos
        </button>
        <button
          onClick={() => handleScreenChange('scanner')}
          className={`w-full flex items-center p-4 text-left ${
            currentScreen === 'scanner' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          } hover:bg-blue-50`}
          type="button"
        >
          <Scan size={20} className="mr-2" /> Scanner
        </button>
        <button
          onClick={() => handleScreenChange('reports')}
          className={`w-full flex items-center p-4 text-left ${
            currentScreen === 'reports' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          } hover:bg-blue-50`}
          type="button"
        >
          <FileText size={20} className="mr-2" /> Relatórios
        </button>
        <button
          onClick={() => handleScreenChange('settings')}
          className={`w-full flex items-center p-4 text-left ${
            currentScreen === 'settings' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          } hover:bg-blue-50`}
          type="button"
        >
          <Settings size={20} className="mr-2" /> Configurações
        </button>
      </nav>
    </div>

    {/* Main Content */}
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow p-4 flex justify-between items-center md:ml-64">
        <button onClick={toggleSidebar} className="md:hidden" type="button">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold">
          {currentScreen === 'dashboard' && 'Dashboard'}
          {currentScreen === 'products' && 'Produtos'}
          {currentScreen === 'scanner' && 'Scanner de QR Code'}
          {currentScreen === 'productDetails' && 'Detalhes do Produto'}
          {currentScreen === 'reports' && 'Relatórios'}
          {currentScreen === 'settings' && 'Configurações'}
        </h2>
        <div />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:ml-64">
        {success && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg flex items-center">
            <CheckCircle size={20} className="mr-2" />
            {success}
          </div>
        )}
        {errors.general && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
            <AlertTriangle size={20} className="mr-2" />
            {errors.general}
          </div>
        )}

        {/* Dashboard */}
        {currentScreen === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Total de Produtos</h3>
              <p className="text-3xl font-bold">{products.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Estoque Total</h3>
              <p className="text-3xl font-bold">
                {products.reduce((sum, p) => sum + p.quantity, 0)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-2">Valor do Estoque</h3>
              <p className="text-3xl font-bold">
                R${products.reduce((sum, p) => sum + p.quantity * p.price, 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow col-span-1 md:col-span-2 lg:col-span-3">
              <h3 className="text-lg font-semibold mb-2">Últimas Movimentações</h3>
              <div className="space-y-2">
                {movements.slice(-5).reverse().map((movement) => (
                  <div key={movement.id} className="flex justify-between text-sm">
                    <span>
                      {movement.productName} ({movement.type}): {movement.quantity}
                    </span>
                    <span>{new Date(movement.date).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Produtos */}
        {currentScreen === 'products' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Lista de Produtos</h3>
              <button
                onClick={openModal}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
                type="button"
              >
                <Plus size={20} className="mr-2" />
                Novo Produto
              </button>
            </div>
            <ProductSearch onSearchChange={setSearchTerm} searchTerm={searchTerm} />
            <ProductList
              products={filteredProducts}
              onEdit={setEditingProduct}
              onDelete={deleteProduct}
              onSelectProduct={handleSelectProduct}
            />
          </div>
        )}

        {/* Scanner */}
        {currentScreen === 'scanner' && (
          <div className="p-4 pb-20 md:pb-4">
            {errors.camera && (
              <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center">
                <AlertTriangle size={20} className="mr-2" />
                {errors.camera}
              </div>
            )}
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 size={40} className="animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={startRealQRScanner}
                  className="w-full bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center"
                  type="button"
                  disabled={scannerActive}
                >
                  <Camera size={20} className="mr-2" />
                  Iniciar Scanner
                </button>
                {scannerActive && (
                  <div className="relative">
                    <video ref={videoRef} className="w-full rounded-lg" playsInline />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </div>
                )}
              </div>
            )}
            {scannedProduct && (
              <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                <h3 className="text-lg font-semibold">Produto Escaneado</h3>
                <p>Nome: {scannedProduct.name}</p>
                <p>Código: {scannedProduct.id}</p>
                <p>Estoque: {scannedProduct.quantity}</p>
                <p>Preço: R${parseFloat(scannedProduct.price).toFixed(2)}</p>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Tipo de Movimentação</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Selecione</option>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                  {errors.movementType && (
                    <p className="text-red-500 text-sm mt-1">{errors.movementType}</p>
                  )}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Quantidade</label>
                  <input
                    type="number"
                    value={movementQuantity}
                    onChange={(e) => setMovementQuantity(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                  {errors.movementQuantity && (
                    <p className="text-red-500 text-sm mt-1">{errors.movementQuantity}</p>
                  )}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <input
                    type="text"
                    value={movementDescription}
                    onChange={(e) => setMovementDescription(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleMovement}
                  className="mt-4 w-full bg-blue-600 text-white p-2 rounded-lg flex items-center justify-center"
                  type="button"
                >
                  <Check size={20} className="mr-2" />
                  Registrar Movimentação
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detalhes do Produto */}
        {currentScreen === 'productDetails' && selectedProduct && (
          <div className="p-4 pb-20 md:pb-4">
            <h3 className="text-lg font-semibold mb-4">Detalhes do Produto</h3>
            <div className="bg-white p-6 rounded-lg shadow">
              <p><strong>Nome:</strong> {selectedProduct.name}</p>
              <p><strong>Código:</strong> {selectedProduct.id}</p>
              <p><strong>Marca:</strong> {selectedProduct.brand || 'N/A'}</p>
              <p><strong>Categoria:</strong> {selectedProduct.category || 'N/A'}</p>
              <p><strong>Estoque:</strong> {selectedProduct.quantity}</p>
              <p><strong>Preço:</strong> R${parseFloat(selectedProduct.price).toFixed(2)}</p>
              <p><strong>QR Code:</strong> {selectedProduct.qrCode || 'N/A'}</p>
              <div className="mt-4">
                <LabelPreview product={selectedProduct} labelConfig={labelConfig} />
              </div>
              <div className="mt-4 flex space-x-4">
                <button
                  onClick={() => generateLabel(selectedProduct)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
                  type="button"
                >
                  <Download size={20} className="mr-2" />
                  Gerar Etiqueta
                </button>
                <button
                  onClick={() => setEditingProduct(selectedProduct)}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
                  type="button"
                >
                  <Edit size={20} className="mr-2" />
                  Editar Produto
                </button>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Tipo de Movimentação</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Selecione</option>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                </select>
                {errors.movementType && (
                  <p className="text-red-500 text-sm mt-1">{errors.movementType}</p>
                )}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Quantidade</label>
                <input
                  type="number"
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  min="1"
                />
                {errors.movementQuantity && (
                  <p className="text-red-500 text-sm mt-1">{errors.movementQuantity}</p>
                )}
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Descrição</label>
                <input
                  type="text"
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={handleMovement}
                className="mt-4 w-full bg-blue-600 text-white p-2 rounded-lg flex items-center justify-center"
                type="button"
              >
                <Check size={20} className="mr-2" />
                Registrar Movimentação
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  </div>
);  

// Parte 8 de 8: JSX restante (relatórios, configurações, modais) e exportação do componente
    {/* Relatórios */}
    {currentScreen === 'reports' && (
      <div className="p-4 pb-20 md:pb-4">
        <h3 className="text-lg font-semibold mb-4">Relatórios</h3>
        <div className="space-y-4">
          <button
            onClick={exportToPDF}
            className="w-full bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center"
            type="button"
          >
            <FileText size={20} className="mr-2" />
            Exportar Estoque para PDF
          </button>
          <button
            onClick={exportToExcel}
            className="w-full bg-green-600 text-white p-3 rounded-lg flex items-center justify-center"
            type="button"
          >
            <FileSpreadsheet size={20} className="mr-2" />
            Exportar Estoque para Excel
          </button>
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-md font-semibold mb-2">Histórico de Movimentações</h4>
            <div className="space-y-2">
              {movements.length === 0 ? (
                <p className="text-gray-500">Nenhuma movimentação registrada.</p>
              ) : (
                movements.map((movement) => (
                  <div key={movement.id} className="flex justify-between text-sm">
                    <span>
                      {movement.productName} ({movement.type}): {movement.quantity}
                    </span>
                    <span>{new Date(movement.date).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Configurações */}
    {currentScreen === 'settings' && (
      <div className="p-4 pb-20 md:pb-4">
        <h3 className="text-lg font-semibold mb-4">Configurações</h3>
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
            <input
              type="text"
              value={companySettings.name}
              onChange={(e) =>
                setCompanySettings({ ...companySettings, name: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contato</label>
            <input
              type="text"
              value={companySettings.contact}
              onChange={(e) =>
                setCompanySettings({ ...companySettings, contact: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Logo (URL)</label>
            <input
              type="text"
              value={companySettings.logo}
              onChange={(e) =>
                setCompanySettings({ ...companySettings, logo: e.target.value })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
          <LabelEditor labelConfig={labelConfig} setLabelConfig={setLabelConfig} onSave={() => setSuccess('✅ Configuração de etiqueta salva!')} />
        </div>
      </div>
    )}

    {/* Modal para Adicionar/Editar Produto */}
    {isModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Editar Produto' : 'Novo Produto'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                type="text"
                value={editingProduct ? editingProduct.name : ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Código</label>
              <input
                type="text"
                value={editingProduct ? editingProduct.id : ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, id: e.target.value })
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
                disabled={!!editingProduct}
              />
              {errors.id && <p className="text-red-500 text-sm mt-1">{errors.id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Marca</label>
              <input
                type="text"
                value={editingProduct ? editingProduct.brand : ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, brand: e.target.value })
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Categoria</label>
              <input
                type="text"
                value={editingProduct ? editingProduct.category : ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, category: e.target.value })
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantidade</label>
              <input
                type="number"
                value={editingProduct ? editingProduct.quantity : ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, quantity: parseInt(e.target.value) || 0 })
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
                min="0"
              />
              {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                value={editingProduct ? editingProduct.price : ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
                min="0"
              />
              {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">QR Code (opcional)</label>
              <input
                type="text"
                value={editingProduct ? editingProduct.qrCode : ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, qrCode: e.target.value })
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => (editingProduct ? updateProduct(editingProduct) : addProduct(editingProduct || {}))}
                className="w-full bg-blue-600 text-white p-2 rounded-lg flex items-center justify-center"
                type="button"
              >
                <Save size={20} className="mr-2" />
                Salvar
              </button>
              <button
                onClick={closeModal}
                className="w-full bg-gray-300 text-gray-700 p-2 rounded-lg flex items-center justify-center"
                type="button"
              >
                <X size={20} className="mr-2" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};

export default EstoqueFFApp;

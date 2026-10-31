import { HashRouter, Routes, Route } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import ItemDetailPage from './pages/ItemDetailPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import AdminApproveCheckoutPage from './pages/AdminApproveCheckoutPage.jsx';
import ReturnPage from './pages/ReturnPage.jsx';
import AdminApproveReturnPage from './pages/AdminApproveReturnPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import Dev from './pages/Dev.jsx';
import DevReal from './pages/DevReal.jsx';

export default function App() {
  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<InventoryPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/item/:id" element={<ItemDetailPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/checkout/:id" element={<CheckoutPage />} />
          <Route path="/admin-approve-checkout/:loanId" element={<AdminApproveCheckoutPage />} />
          <Route path="/return/:loanId" element={<ReturnPage />} />
          <Route path="/admin-approve-return/:loanId" element={<AdminApproveReturnPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/dev" element={<Dev />} />
          <Route path="/dev-real" element={<DevReal />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}

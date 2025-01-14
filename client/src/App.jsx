import { useState, useEffect } from 'react'
import { Navigate, Outlet, Routes, Route } from 'react-router-dom'
import Login from './pages/auth/login'
import Register from './pages/auth/register'
import Dashboard from './pages/dashboard'
// import RootLayout from './layouts/root'
import Transactions from './pages/transactions'
import SettingsPage from './pages/settingsPage'
import AccountPage from './pages/accountPage'
import { useStore } from './store'
import { setAuthToken } from './libs/apiCalls'
import { Toaster } from 'sonner';
import Navbar from './components/Navbar'

const RootLayout = () => {
  const {user} = useStore(state => state)
  setAuthToken(user?.token || null)
  
  console.log(user)
  return (
    !user ? (
      <Navigate to="/login" />
    ):(
      <>
        <Navbar />
        <div className='min-h-[calc(h-screen-100px)]'>
          <Outlet />
        </div>
      </>
    )
  )
}


function App() {
  const [count, setCount] = useState(0)
  const { theme } = useStore((state) => state);

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

  return (
    <>
      <Toaster position="top-center" richColors />
      <main>
        <div className='w-full min-h-screen px-6 bg-gray-100 md:px-20 dark:bg-gray-800'>
          <Routes>
              <Route element={<RootLayout/>}>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/accounts" element={<AccountPage />} />


              </Route>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
          </Routes>
          
        </div>
      </main>
    </>
  )
}

export default App

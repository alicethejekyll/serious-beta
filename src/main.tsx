import {createRoot} from 'react-dom/client';import {UserApp} from './UserApp';import {AdminApp} from './AdminApp';import './styles.css';
createRoot(document.getElementById('root')!).render(location.pathname.startsWith('/admin')?<AdminApp/>:<UserApp/>);

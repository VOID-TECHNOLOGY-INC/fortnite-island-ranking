import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { Home } from './pages/Home';
import Compare from './pages/Compare';
import IslandDetail from './pages/IslandDetail';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'island/:code', element: <IslandDetail /> },
      { path: 'compare', element: <Compare /> }
    ]
  }
]);



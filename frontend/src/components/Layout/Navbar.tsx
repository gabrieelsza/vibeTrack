import React from 'react';
import { Header } from '../Poster/Header';

interface NavbarProps {
  activeTab: 'analyze' | 'history';
  onChangeTab: (tab: 'analyze' | 'history') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onChangeTab }) => {
  return <Header activeTab={activeTab} onChangeTab={onChangeTab} />;
};

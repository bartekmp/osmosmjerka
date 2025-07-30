import React from 'react';
import { render, screen } from '@testing-library/react';
import WordList from '../WordList';
import { withI18n } from '../../testUtils';

const words = [
    { word: 'apple', translation: 'jabuka' },
    { word: 'pear', translation: 'kruška' }
];

test('renders all words', () => {
    render(withI18n(<WordList words={words} found={[]} hideWords={false} setHideWords={() => { }} allFound={false} showTranslations={false} setShowTranslations={() => { }} />));
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('pear')).toBeInTheDocument();
});

test('hides words when hideWords is true', () => {
    render(withI18n(<WordList words={words} found={[]} hideWords={true} setHideWords={() => { }} allFound={false} showTranslations={false} setShowTranslations={() => { }} />));
    expect(screen.getByRole('list')).toHaveClass('blurred');
});

test('disables show words button when disableShowWords is true', () => {
    render(withI18n(<WordList words={words} found={[]} hideWords={true} setHideWords={() => { }} allFound={false} showTranslations={false} setShowTranslations={() => { }} disableShowWords={true} />));
    const button = screen.getByRole('button', { name: /show/i });
    expect(button).toBeDisabled();
});

test('shows translations when showTranslations is true', () => {
    render(withI18n(<WordList words={words} found={['apple']} hideWords={false} setHideWords={() => { }} allFound={false} showTranslations={true} setShowTranslations={() => { }} />));
    expect(screen.getByText('jabuka')).toBeInTheDocument();
});
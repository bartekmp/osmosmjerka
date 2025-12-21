import React from 'react';
import { render, screen } from '@testing-library/react';
import PhraseList from '../PhraseList';
import { withI18n } from '../../../../../testUtils';

const phrases = [
    { phrase: 'apple', translation: 'jabuka' },
    { phrase: 'pear', translation: 'kruška' }
];

test('renders all phrases', () => {
    render(withI18n(<PhraseList phrases={phrases} found={[]} hidePhrases={false} setHidePhrases={() => { }} allFound={false} showTranslations={false} setShowTranslations={() => { }} />));
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('pear')).toBeInTheDocument();
});

test('hides phrases when hidePhrases is true', () => {
    render(withI18n(<PhraseList phrases={phrases} found={[]} hidePhrases={true} setHidePhrases={() => { }} allFound={false} showTranslations={false} setShowTranslations={() => { }} />));
    expect(screen.getByRole('list')).toHaveClass('blurred');
});

test('disables show phrases button when disableShowPhrases is true', () => {
    render(withI18n(<PhraseList phrases={phrases} found={[]} hidePhrases={true} setHidePhrases={() => { }} allFound={false} showTranslations={false} setShowTranslations={() => { }} disableShowPhrases={true} />));
    const button = screen.getByRole('button', { name: /0\/2/i });
    expect(button).toBeDisabled();
});

test('shows translations when showTranslations is true', () => {
    render(withI18n(<PhraseList phrases={phrases} found={['apple']} hidePhrases={false} setHidePhrases={() => { }} allFound={false} showTranslations={true} setShowTranslations={() => { }} />));
    expect(screen.getByText('jabuka')).toBeInTheDocument();
});
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GridCell from '../GridCell';

test('renders cell with correct value and classes', () => {
    render(<table><tbody><tr>
        <GridCell r={0} c={1} cell="X" isSelected={true} isFound={false} handleMouseDown={() => { }} handleMouseEnter={() => { }} />
    </tr></tbody></table>);
    const td = screen.getByText('X');
    expect(td).toHaveClass('grid-cell');
    expect(td).toHaveClass('selected');
    expect(td).not.toHaveClass('found');
});

test('calls handlers on mouse events', () => {
    const onDown = jest.fn();
    const onEnter = jest.fn();
    render(<table><tbody><tr>
        <GridCell r={2} c={3} cell="Y" isSelected={false} isFound={true} handleMouseDown={onDown} handleMouseEnter={onEnter} />
    </tr></tbody></table>);
    const td = screen.getByText('Y');
    fireEvent.mouseDown(td);
    fireEvent.mouseEnter(td);
    expect(onDown).toHaveBeenCalledWith(2, 3);
    expect(onEnter).toHaveBeenCalledWith(2, 3);
});
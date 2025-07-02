export default function AdminTable({ rows, setEditRow }) {
    return (
        <table
            style={{
                marginTop: '1rem',
                borderCollapse: 'separate',
                borderSpacing: 0,
                background: '#fff'
            }}
        >
            <thead>
                <tr>
                    <th style={{ padding: '6px 12px 6px 0' }}>ID</th>
                    <th style={{ padding: '6px 12px 6px 0' }}>Categories</th>
                    <th style={{ padding: '6px 12px 6px 0' }}>Word</th>
                    <th style={{ padding: '6px 12px 6px 0' }}>Translation</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {rows.map(row => (
                    <tr key={row.id}>
                        <td style={{
                            borderRight: '2px solid #e0e0e0',
                            padding: '6px 12px 6px 0'
                        }}>{row.id}</td>
                        <td style={{
                            borderRight: '2px solid #e0e0e0',
                            padding: '6px 12px 6px 0'
                        }}>{row.categories}</td>
                        <td style={{
                            borderRight: '2px solid #e0e0e0',
                            padding: '6px 12px 6px 0'
                        }}>{row.word}</td>
                        <td style={{
                            borderRight: '2px solid #e0e0e0',
                            padding: '6px 12px 6px 0'
                        }}>{row.translation}</td>
                        <td style={{ padding: '6px 0 6px 12px' }}>
                            <button className="scrabble-btn" onClick={() => setEditRow(row)}>Edit</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
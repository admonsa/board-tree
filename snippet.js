var getId = (x) => `${x.boardId}__${x.columnId}`;

var nodes = Object.values(globalStore.getState().boardsEntities)
    .reduce((map, board) => {
        board?.board_data?.columns?.forEach((col) => {
            map.set(getId({boardId: board.id, columnId: col.id}), {boardId: board.id, title: col.title, type: col.type})
        })
        return map;
    }, new Map())

var subitems = {boardId: undefined, columnId: undefined};

var relations = Object.entries(globalStore.getState().boardsEntities)
    .flatMap(([boardId, board]) => board.board_data?.columns?.map(x => {
            if (x.type === "board-relation") {
                return ({
                    column: {
                        boardId,
                        columnId: x.id,
                    }, dependentColumns: x.settings.boardIds?.map(y => ({column: {boardId: y, columnId: 'name'}})) || []
                })
            } else if (x.type === "subtasks") {
                subitems.boardId = x.settings.boardIds[0]
                subitems.columnId = x.id;
                return ({
                    column: {
                        boardId,
                        columnId: x.id,
                    }, dependentColumns: x.settings.boardIds.map(y => ({column: {boardId: y, columnId: 'name'}}))
                })
            } else if (x.type === "formula") {
                var set = new Set(board.board_data?.columns.map(x => x.id))
                var regex = /(\{(\w+)})/g
                let item;
                var dependentColumns = new Set();
                while (item = regex.exec(x.settings.formula)) {
                    const columnId = item[2];
                    if (set.has(columnId)) dependentColumns.add(columnId);
                }
                return ({
                    column: {
                        boardId,
                        columnId: x.id,
                    },
                    dependentColumns: [...dependentColumns].map(columnId => ({
                        column: {
                            boardId,
                            columnId
                        }
                    }))
                })
            } else if (x.type === "lookup") {
                // const connectBoardColumnIds = Object.keys(x.settings.relation_column).map(columnId => ({
                //     column: {
                //         boardId,
                //         columnId
                //     }
                // }))
                let linkedColumns = Object.entries(x.settings.displayed_linked_columns).flatMap(([boardId, columnIds]) => columnIds.map(columnId => ({
                    column: {
                        boardId,
                        columnId
                    }
                })));
                return ({
                    column: {
                        boardId,
                        columnId: x.id,
                    },
                    dependentColumns: linkedColumns
                })
            } else {
                return ({
                    column: {
                        boardId,
                        columnId: x.id,
                    }, dependentColumns: []
                })
            }
        })
    )
    .filter(Boolean)
    .filter(x => !!x.dependentColumns?.length)

function generateCode(columnRelations, rootBoardId) {
    graph = columnRelations.reduce((map, rel) => {
        const id = getId(rel.column);
        map.set(id, rel)
        return map;
    }, new Map());

    var subtasksChildren;

    const rec = (column) => {
        const node = nodes.get(getId(column));
        const x = graph.get(getId(column));
        const type = node?.type === 'board-relation' ? 'connect board' : node?.type === 'lookup' ? 'mirror' : node?.type;
        const name = `${column.boardId} - ${node?.title || column.columnId} (${type})`;
        if (type === 'subtasks') return {name, children: subtasksChildren}
        return {
            name,
            children: x?.dependentColumns?.map((x) => rec(x.column)) || [],
        };
    };
    if (subitems.boardId) {
        subtasksChildren = columnRelations
            .filter(x => x.column.boardId === `${subitems.boardId}`)
            .map(x => rec(x.column))
            .filter(x => !!x.children?.length)
    }

    children = columnRelations
        .filter(x => x.column.boardId === `${rootBoardId}`)
        .map(x => rec(x.column))
        .filter(x => !!x.children?.length)

    return {
        id: 'root',
        name: 'root',
        children
    }
}

const regexpResult = /boards\/(\d+)/.exec(window.location.href)
if (regexpResult) {
    const boardId = regexpResult[1]
    const obj = generateCode(relations, boardId)
    window.open(`https://admonsa.github.io/board-tree?graph=${btoa(JSON.stringify(obj))}`)
}


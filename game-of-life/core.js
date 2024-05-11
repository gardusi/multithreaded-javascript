/******************************
 * GRID RULES DEFINITION
 ******************************/

class Grid {
  /**
   * @param {Number} size size of the board
   * @param {Buffer} buffer buffer of the current and next board
   * @param {Function} paint method that paints a cell
   */
  constructor(size, buffer, paint = () => {}) {
    const sizeSquared = size * size

    this.buffer = buffer
    this.size = size
    this.paint = paint

    this.cells = new Uint8Array(this.buffer, 0, sizeSquared)
    this.nextCells = new Uint8Array(this.buffer, sizeSquared, sizeSquared)
  }

  /**
   * @param {Number} x 
   * @param {Number} y 
   */
  getCell(x, y) {
    const size = this.size
    const sizeM1 = size - 1

    x = x < 0 ? sizeM1 : x > sizeM1 ? 0 : x
    y = y < 0 ? sizeM1 : y > sizeM1 ? 0 : y

    return this.cells[x * size + y]
  }

  static NEIGHBORS = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]
  ]

  /**
   * Bounds for which to calculate next cells
   * @param {Number} minX 
   * @param {Number} minY 
   * @param {Number} maxX 
   * @param {Number} maxY 
   */
  iterate(minX, minY, maxX, maxY) {
    const size = this.size

    for (let x = minX; x < maxX; x++) {
      for (let y = minY; y < maxY; y++) {
        const cell = this.cells[x * size + y]

        let alive = 0
        for (const [i, j] of Grid.NEIGHBORS) {
          alive += this.getCell(x + i, y + j)
        }

        const newCell = alive === 3 || (cell && alive === 2) ? 1 : 0

        this.nextCells[x * size + y] = newCell
        this.paint(newCell, x, y)
      }
    }

    const cells = this.nextCells
    this.nextCells = this.cells
    this.cells = cells
  }
}


/******************************
 * USER INTERFACE SETUP
 ******************************/

const BLACK = 0xFF000000
const WHITE = 0xFFFFFFFF
const SIZE = 1000

const iterationCounter = document.getElementById('iteration')

const gridCanvas = document.getElementById('gridcanvas')
gridCanvas.height = SIZE
gridCanvas.width = SIZE

const ctx = gridCanvas.getContext('2d')
const data = ctx.createImageData(SIZE, SIZE)
const buffer = new Uint32Array(data.data.buffer)

const paint = (cell, x, y) => {
  buffer[x * SIZE + y] = cell ? BLACK : WHITE
}

const grid = new Grid(SIZE, new ArrayBuffer(2 * SIZE * SIZE), paint)
for (let x = 0; x < SIZE; x++) {
  for (let y = 0; y < SIZE; y++) {
    const cell = Math.random() < 0.5 ? 0 : 1
    grid.cells[x * SIZE + y] = cell
    paint(cell, x, y)
  }
}

ctx.putImageData(data, 0, 0)

/******************************
 * BROWSER ENGINE ITERATION
 ******************************/

let iteration = 0
const iterate = (...args) => {
  grid.iterate(...args)
  ctx.putImageData(data, 0, 0)
  iterationCounter.innerHTML = ++iteration

  window.requestAnimationFrame(() => iterate(...args))
}

iterate(0, 0, SIZE, SIZE)

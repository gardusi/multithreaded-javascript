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
const THREADS = 5

const imageOffset = 2 * SIZE * SIZE
const syncOffset = imageOffset + 4 * SIZE * SIZE

const isMainThread = !!self.window

if (isMainThread) {
  const iterationCounter = document.getElementById('iteration')
  const gridCanvas = document.getElementById('gridcanvas')

  gridCanvas.height = SIZE
  gridCanvas.width = SIZE

  const ctx = gridCanvas.getContext('2d')

  const sharedMemory = new SharedArrayBuffer(syncOffset + THREADS * 4)

  const cells = new Uint8Array(sharedMemory, 0, imageOffset)
  
  const sharedImageBuffer = new Uint32Array(sharedMemory, imageOffset)
  const sharedImageBuffer8 = new Uint8ClampedArray(sharedMemory, imageOffset, 4 * SIZE * SIZE)

  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      const cell = Math.random() < 0.5 ? 0 : 1
      cells[x * SIZE + y] = cell
      sharedImageBuffer[x * SIZE + y] = cell ? BLACK : WHITE
    }
  }
  
  const imageData = new ImageData(SIZE, SIZE)
  imageData.data.set(sharedImageBuffer8)
  ctx.putImageData(imageData, 0, 0)

  const chunkSize = SIZE / THREADS
  for (let i = 0; i < THREADS; i++) {
    const worker = new Worker('core.js', { name: `worker-${i}` })
    worker.postMessage({
      range: [0, chunkSize * i, SIZE, chunkSize * (i + 1)],
      sharedMemory,
      i,
    })
  }

  const coordWorker = new Worker('core.js', { name: `worker-coord` })
  coordWorker.postMessage({ coord: true, sharedMemory })

  let iteration = 0
  coordWorker.addEventListener('message', () => {
    imageData.data.set(sharedImageBuffer8)
    ctx.putImageData(imageData, 0, 0)
    iterationCounter.innerHTML = ++iteration
    window.requestAnimationFrame(() => coordWorker.postMessage({}))
  })
} else {
  let sharedMemory
  let sync
  let sharedImageBuffer
  let cells
  let nextCells

  const initListener = (message) => {
    const opts = message.data
    sharedMemory = opts.sharedMemory
    sync = new Int32Array(sharedMemory, syncOffset)
    self.removeEventListener('message', initListener)

    if (opts.coord) {
      self.addEventListener('message', runCoord)
      cells = new Uint8Array(sharedMemory)
      nextCells = new Uint8Array(sharedMemory, SIZE * SIZE)
      sharedImageBuffer = new Uint32Array(sharedMemory, imageOffset)
      runCoord()
    } else {
      runWorker(opts)
    }
  }

  const runWorker = ({ range, i }) => {
    const grid = new Grid(SIZE, sharedMemory)
    while (true) {
      Atomics.wait(sync, i, 0)

      grid.iterate(...range)
      
      Atomics.store(sync, i, 0)
      Atomics.notify(sync, i)
    }
  }

  const runCoord = () => {
    for (let i = 0; i < THREADS; i++) {
      Atomics.store(sync, i, 1)
      Atomics.notify(sync, i)
    }
    for (let i = 0; i < THREADS; i++) {
      Atomics.wait(sync, i, 1)
    }
    const oldCells = cells
    cells = nextCells
    nextCells = oldCells
    
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        sharedImageBuffer[x * SIZE + y] = cells[x * SIZE + y] ? BLACK : WHITE
      }
    }
    self.postMessage({})
  }

  self.addEventListener('message', initListener)
}

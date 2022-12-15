// chalk makes it easy to add style to terminal output
import chalk from 'chalk'

// fs handles interacting with the file system
import fs from 'fs'

// Common node utility functions
import util from 'util'

/*
  Turn the fs.readFile() function into one that returns a promise
*/
const readFile = fileName => util.promisify(fs.readFile)(fileName, 'utf8')

/*
  PrintableText receives a path to a txt file and can print it to
  the console in varying speeds, one line at a time.
*/
class PrintableText {
  // Get the path to a txt file and assign default values
  constructor(path) {
    // Path to the txt file that will be used for printing
    this.path = path

    // Content will be populated with after txt file is loaded
    this.content = []

    // Number of lines that contain the letter introduction
    this.introLineCount = 12

    // Fast delay will be used to print the introduction lines
    // Slow delay will be used to print the body of the letter
    this.delays = { slow: 1500, fast: 50 }

    // Index of current line in the letter
    this.index = 0

    // Variable to store the setInterval interval so it can be cleared
    this.interval = null

    // Console log style
    this.style = chalk.blue.bgRed.bold
  }

  /*
    Returns the duration of printing the intro lines
  */
  getInitialDelay() {
    return this.introLineCount * this.delays.fast
  }

  /*
    Returns a boolean indicating whether all lines have been printed
  */
  isPrinted() {
    return this.index >= this.content.length - 1
  }

  /*
    Update the state of the internal interval, index, and printing speed
  */
  update() {
    if (this.isPrinted()) {
      // Stop printing
      clearInterval(this.interval)
    } else {
      // Increment index
      this.index = this.index + 1

      if (this.index >= this.introLineCount) {
        // Change printing speed
        this.print(this.delays.slow)
      }
    }
  }

  /*
    Print a single line
  */
  printLine() {
    // Current line based on index
    const line = this.content[this.index]

    // Print the line to the console
    console.log(this.style(line))

    // Update internal variables
    this.update()
  }

  /*
    Print all lines with a given speed,
    starting from the current index
  */
  print(delay) {
    // First clear the interval in case this isn't
    // the first time print() is called
    clearInterval(this.interval)

    // Print the first line if we're just starting
    if (this.index === 0) {
      this.printLine()
    }

    // Print one line at a time with the given delay
    this.interval = setInterval(() => this.printLine(), delay)
  }

  /*
    Load the file and start printing int
  */
  start() {
    // Read the txt file
    readFile(this.path).then(content => {
      // Split the contents of the file into an array of lines based on line breaks
      this.content = content.split('\n')

      // Start printing at the fast speed
      this.print(this.delays.fast)
    }).catch(err => console.error(err))
  }
}

export default PrintableText

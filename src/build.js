function GetOccurrenceCount(string, search)
{
  let count = 0;
  let fromIndex = -1;
  while(true)
  {
    fromIndex = string.indexOf(search, fromIndex + 1);
    if(fromIndex === -1)
    {
      return count;
    }
    ++count;
  }
}

const fs = require('fs');
function GetFileContent(filename)
{
  return fs.readFileSync(filename, 'utf8')
}

let templateHtml = GetFileContent('template.html');
const cheerio = require('cheerio');
let showdown = require('showdown');
showdown.setOption('noHeaderId', 'true');
const showdownHighlight = require('showdown-highlight');
const converter = new showdown.Converter({extensions: [showdownHighlight]});

function CorrectLink(html, selector, attribute, correction)
{
    let linkElement = html(selector);
    let filePath = linkElement.attr(attribute);
    filePath = correction + filePath;
    linkElement.attr(attribute, filePath);
}

function IsBuildNeeded(inputFile, outputFile)
{
  exists = fs.existsSync(outputFile);
  if(!exists)
  {
    return true;
  }

  let inputStats = fs.statSync(inputFile);
  let outputStats = fs.statSync(outputFile);
  let inputModifiedDate = inputStats.mtime;
  let outputModifiedDate = outputStats.mtime;
  return inputModifiedDate >= outputModifiedDate;
}

function MakeRequiredDirectories(outputFile)
{
  let dirEnd = outputFile.lastIndexOf('/');
  let dirPath = outputFile.slice(0, dirEnd);
  let options = {recursive: true};
  fs.mkdirSync(dirPath, options);
}

function RenderMarkdown(inputFile, destination, rebuild)
{
  // Before rendering a markdown document to html, we first check to see if the
  // output html document is already up to date with the current markdown
  // document. If it is up to date and we are not rebuilding, then no rendering
  // is required.
  let exists = fs.existsSync(inputFile);
  if(!exists)
  {
    console.error(inputFile + ' does not exist');
    return;
  }
  let filenameEnd = inputFile.indexOf('.');
  let outputFile = inputFile.slice(0, filenameEnd);
  outputFile = destination + outputFile + '.html';
  if(!rebuild && !IsBuildNeeded(inputFile, outputFile))
  {
    return;
  }
  MakeRequiredDirectories(outputFile);

  // Before rendering the markdown document, we first fix all the links
  // contained in the template html if the output html will exist in a
  // directory below the root.
  let template = cheerio.load(templateHtml);
  let depth = GetOccurrenceCount(inputFile, '/');
  if(depth > 0)
  {
    let linkCorrection = '';
    for(let i = 0; i < depth; ++i)
    {
      linkCorrection += '../'
    }
    CorrectLink(template, 'link.favicon', 'href', linkCorrection);
    CorrectLink(template, 'link.main_style', 'href', linkCorrection);
    CorrectLink(template, 'link.hljs_style', 'href', linkCorrection);
    CorrectLink(template, 'a.index_link', 'href', linkCorrection);
    CorrectLink(template, 'a.blog_link', 'href', linkCorrection);
    CorrectLink(template, 'a.projects_link', 'href', linkCorrection);
    CorrectLink(template, 'script.main_script', 'src', linkCorrection);
  }

  // Render the markdown document to html.
  let markdown = fs.readFileSync(inputFile, 'utf8');
  let html = converter.makeHtml(markdown);
  template('div.content_container').append(html);

  // Put all <pre><code> blocks inside of a code box div.
  template('pre code').each(function(i, domElement)
  {
    template(this).parent().replaceWith('<div class=\"code_box"><pre><code>' +
      template(this).html());
  });

  // Apply lazy loading to all images and add the image_box class to the parent
  // element because all images are contained in an image box.
  template('img').each(function(i, domElement)
  {
    let image = template(this);
    image.attr('loading', 'lazy');
    let imageContainer = image.parent();
    imageContainer.attr('class', 'image_box');
  });

  // Ouput the new html to its destination.
  let outputHtml = template.html();
  fs.writeFileSync(outputFile, outputHtml, 'utf8');
  console.log('Built ' + inputFile);
}

function RenderRecursively(directory, destination, rebuild)
{
  let options = {withFileTypes: true};
  let files = fs.readdirSync(directory, options);
  for(let i = 0; i < files.length; ++i)
  {
    let file = files[i];
    if(file.isDirectory())
    {
      RenderRecursively(directory + file.name + '/', destination, rebuild);
    }

    if(file.name.length >= 3)
    {
      let end  = file.name.slice(file.name.length - 3);
      if(end === '.md')
      {
        RenderMarkdown(directory + file.name, destination, rebuild);
      }
    }
  }
}

let rebuild = false;
let makeTests = false;
if(process.argv.length > 2)
{
  rebuild = process.argv[2] === 'r';
  makeTests = process.argv[2] === 't';
}
if(makeTests)
{
  RenderMarkdown('index.md', '../', true);
}

RenderMarkdown('index.md', '../', rebuild);
RenderRecursively('blog/', '../', rebuild);
RenderRecursively('projects/', '../', rebuild);

const express = require('express');
const path = require('path');
const app = express();
//for connecting css files
app.use(express.static(path.join(__dirname)));


//PAGES

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/content', (req, res) => {
    res.sendFile(path.join(__dirname, 'content.html'));
});

app.get('/gallery', (req, res) => {
    res.sendFile(path.join(__dirname, 'gallery.html'));
});

app.get('/news', (req, res) => {
    res.sendFile(path.join(__dirname, 'news.html'));
});



app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
});
//for opening the website on your computer
app.listen(3000, () => {
    console.log('Works. Tab is: http://localhost:3000');
});
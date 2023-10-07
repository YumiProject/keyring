import * as openpgp from "@openpgp";

const DIST_DIR = "dist";
const ROOT_URL = "https://keyring.yumi.dev";

console.log("Creating dist directory.");
try {
	await Deno.remove(DIST_DIR, {recursive: true});
} catch (e) {
	if (!(e instanceof Deno.errors.NotFound)) {
		throw e;
	}
}
await Deno.mkdir(DIST_DIR);
await Deno.mkdir(DIST_DIR + "/keyring");

console.log("Building...");
await Deno.copyFile("build_logic/style.css", DIST_DIR + "/style.css");

interface PageData {
	title: string,
	path: string,
	description: string,
	content: string
}

function new_page(page: PageData) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${page.title}</title>
	<link rel="preload" href="/style.css" as="style">
	<meta name="description" content="${page.description}">
	<meta property="og:type" content="website">
	<meta property="og:title" content="${page.title}">
	<meta property="og:site_name" content="Yumi Project Keyring">
	<meta property="og:url" content="${ROOT_URL}${page.path}">
	<meta property="og:description" content="${page.description}">
	<link rel="stylesheet" type="text/css" href="/style.css">
</head>
<body>
<header>
	<a href="/" class="wrapper">Yumi Project - Keyring</a>
</header>
<main>${page.content}</main>
<footer>
	<div class="legal">
		<span>
			Hosted on <a href="https://pages.cloudflare.com/">Cloudflare Pages</a>.
		</span>
		<span>
			Except where otherwise noted: &copy; Yumi Project 2023, under <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</a>.
		</span>
	</div>
</footer>

<script type="module">
for (const copyable_code of document.getElementsByClassName("copyable_code")) {
	copyable_code.getElementsByClassName("copy_btn")[0].addEventListener("click", e => {
		const toCopy = copyable_code.getElementsByTagName("span")[0].textContent;
		navigator.clipboard.writeText(toCopy);
	});
}
</script>
</body>
</html>`;
}

async function write_page(page: PageData) {
	const html_page = new_page({
		title: page.title,
		path: page.path === "/index.html" ? "/" : page.path,
		description: page.description,
		content: page.content
	});
	await Deno.writeTextFile(DIST_DIR + page.path, html_page);
}

interface Key {
	id: string;
	name: string;
	description?: string;
	users: string[];
	fancy_path: string;
}

interface Keyring {
	name: string;
	keys: Key[];
}

const keyrings: Keyring[] = [];

for await (const dir_entry of Deno.readDir("keyring")) {
	if (!dir_entry.isDirectory) continue;

	await Deno.mkdir(DIST_DIR + "/keyring/" + dir_entry.name);

	const keyring = {
		name: dir_entry.name.charAt(0).toUpperCase() + dir_entry.name.substring(1),
		keys: []
	} as Keyring;

	keyrings.push(keyring);

	for await (const key_path of Deno.readDir("keyring/" + dir_entry.name)) {
		if (!key_path.isFile) continue;
		if (!key_path.name.endsWith(".asc")) continue;

		const key_raw_name = key_path.name.replace(".asc", "");
		let key_name = key_raw_name.split("_").map(part => part.charAt(0).toUpperCase() + part.substring(1)).join(" ");

		const path = `keyring/${dir_entry.name}/${key_path.name}`;
		const key_block = await Deno.readTextFile(path);
		const read_key = await openpgp.readKey({armoredKey: key_block});

		const key_data = JSON.parse(await Deno.readTextFile(path.replace(".asc", ".json")));

		if (key_data["display_name"]) {
			key_name = key_data["display_name"] as string;
		}
		const description = key_data["description"] ? "<p>" + key_data["description"] + "</p>" : "";

		const key = {
			id: read_key.getKeyID().toHex().toUpperCase(),
			name: key_name,
			description: key_data["description"],
			users: read_key.users.map(user => {
				let str = user.userID.name;

				if (user.userID.comment !== "") {
					str += " (" + user.userID.comment + ")";
				}

				return str + ` <a href="mailto:${user.userID.email}">&lt;${user.userID.email}></a>`;
			}),
			fancy_path: `/keyring/${dir_entry.name}/${key_raw_name}.html`,
		} as Key;
		keyring.keys.push(key);

		await Deno.copyFile(path, `${DIST_DIR}/keyring/${dir_entry.name}/${key_path.name}`);
		await write_page({
			title: key_name + " Key",
			path: key.fancy_path,
			description: `View details about the key "${key_name}".`,
			content: `<h1>${key_name} - <code>${key.id}</code></h1>

${description}
Users:
<ul>
	${key.users.map(user => `<li>${user}</li>`).join("\n")}
</ul>
<p>
To import this key, run the following command in a bash-compatible terminal:<br/>
<code class="copyable_code"><span>curl -sSL ${ROOT_URL}/${path} | gpg --import -</span>
<button class="copy_btn" title="Copy to clipboard"><svg aria-hidden="true" height="16" viewBox="0 0 330 330" version="1.1" width="16" data-view-component="true">
	<g>
		<path d="M35,270h45v45c0,8.284,6.716,15,15,15h200c8.284,0,15-6.716,15-15V75c0-8.284-6.716-15-15-15h-45V15
		c0-8.284-6.716-15-15-15H35c-8.284,0-15,6.716-15,15v240C20,263.284,26.716,270,35,270z M280,300H110V90h170V300z M50,30h170v30H95
		c-8.284,0-15,6.716-15,15v165H50V30z"/>
		<path d="M155,120c-8.284,0-15,6.716-15,15s6.716,15,15,15h80c8.284,0,15-6.716,15-15s-6.716-15-15-15H155z"/>
		<path d="M235,180h-80c-8.284,0-15,6.716-15,15s6.716,15,15,15h80c8.284,0,15-6.716,15-15S243.284,180,235,180z"/>
		<path d="M235,240h-80c-8.284,0-15,6.716-15,15c0,8.284,6.716,15,15,15h80c8.284,0,15-6.716,15-15C250,246.716,243.284,240,235,240z"/>
	</g>
</svg></button></code>
</p>

<h4>Key</h4>

<p>
<a href="/${path}">View Raw</a>
</p>

<pre class="key_block"><code class="key_block">${key_block}</code></pre>`
		});
	}
}

keyrings.sort((a, b) => a.name.localeCompare(b.name));

await write_page({
	title: "Yumi Project - Keyring",
	path: "/index.html",
	description: "The keyring of the Yumi Project. This is the place to find the official public keys used in the project.",
	content: `<p>
	This is the keyring of the Yumi Project, you can find all the public keys that are used in this project to verify the validity of published artifacts and more.
</p>

${keyrings.map(keyring => `<h3>${keyring.name}</h3>
<ul>
	${keyring.keys.map(key => {
		let item = `<li><a href="${key.fancy_path}">${key.name}</a> - <code>${key.id}</code>`;

		if (key.description) {
			item += "<br />" + key.description;
		}

		return item + `</li>`;
	}).join("\n")}
</ul>`).join("\n")}`
});

await write_page({
	title: "404 Not Found",
	path: "/404.html",
	description: "This page does not exist.",
	content: `<h1>404 Not Found</h1>

<p>The requested page could not be found.</p>`
});

nunjucks.configure({ autoescape: true })

var parser = document.createElement('a')
parser.href = document.location.href
var path = parser.pathname
var baseURL = parser.protocol+"//"+parser.host

var username = path.split('/')[1]
var project = path.split('/')[2]

var state = {}

var clientId
if(parser.hostname == "localhost") {
    clientId = "6e3296a6eaa870f520ee50a2f6704d7bcfff3d50db52141f5685424993deb012"
} else {
    clientId = "1235c3cc108113ba9a3c1103453ac1f0fe0f436e8e203653d13abad391be6097"
}

if(path == "/") {
    //
}

if(path == "/callback") {
    var callback = parseQuery(window.location.hash)
    if(typeof callback.error == 'undefined') {
        Cookies.set( 'AccessToken', callback.access_token )
    } else {

    }
    window.close()
}

var githubURL = 'https://api.github.com/repos/'+username+'/'+project

if(typeof Cookies.get('GitHubToken') != 'undefined') {
    githubURL = githubURL+'?access_token='+Cookies.get('GitHubToken')
}

$.ajax({
    url: githubURL,
    statusCode: {
        403: function() {
            var github_token = prompt("The GitHub API has been called too many times. You can enter a personal access token to have unlimited access.")
            if(github_token != null) {
                Cookies.set('GitHubToken', github_token)
            }
        }
    },
    success: function(data) {
        state.repo = data
        $.ajax({
            url: 'https://raw.githubusercontent.com/'+username+'/'+project+'/'+state.repo.default_branch+'/project.json',
            success: function(data) {
                state.project = JSON.parse(data)

                var projectTemplate = $('script[name=project]').text()
                var projectHTML = nunjucks.renderString(projectTemplate, state)

                $('body').append(projectHTML)

                $('button').click(function(e) {
                    if(typeof Cookies.get('AccessToken') == 'undefined') {
                        window.open("https://cloud.digitalocean.com/v1/oauth/authorize?response_type=token&client_id="+clientId+"&redirect_uri="+baseURL+"/callback&scope=read+write",
                                    "oauth",
                                    "menubar=1,resizable=1,width=860,height=600")
                    } else {
                        $('button').prop("disabled",true)
                        $('button').text("checking for ssh-keys...")
                        $.ajax({
                            url: 'https://api.digitalocean.com/v2/account/keys',
                            beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer '+Cookies.get('AccessToken'))},
                            success: function(data) {
                                state.ssh_keys = data.ssh_keys

                                if(state.ssh_keys.length == 0) {
                                    alert("Your DigitalOcean account must have an active ssh-key.")
                                } else {
                                    $('button').text("creating droplet...")
                                    var formData = $('form').serializeObject()
                                    var keys = []
                                    for(var i = 0; i < state.ssh_keys.length; i++) {
                                        keys[i] = state.ssh_keys[i].id
                                    }
                                    var cloudConfig = "#cloud-config\n"+YAML.stringify(state.project.config)
                                    var dropletRequestData = {
                                        name: formData.name,
                                        region: formData.region,
                                        size: formData.size,
                                        image: formData.image,
                                        ssh_keys: keys,
                                        user_data: cloudConfig 
                                    }
                                    $.ajax({
                                        type: 'POST',
                                        url: 'https://api.digitalocean.com/v2/droplets',
                                        data: JSON.stringify(dropletRequestData),
                                        contentType: 'application/json',
                                        beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer '+Cookies.get('AccessToken'))},
                                        success: function(data) {
                                            $('button').text("running scripts...")
                                            state.droplet = data.droplet
                                            console.log(state, cloudConfig)
                                        }
                                    })
                                }
                            }
                        })
                    }

                    return false
                })
            }
        })
    }
})

function parseQuery(qstr) {
    var query = {}
    var a = qstr.substr(1).split('&')
    for (var i = 0; i < a.length; i++) {
        var b = a[i].split('=')
        query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '')
    }
    return query
}

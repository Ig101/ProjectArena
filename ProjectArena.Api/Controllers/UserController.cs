using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectArena.Application.Users.Commands.ChangePassword;
using ProjectArena.Application.Users.Queries.GetActiveUser;

namespace ProjectArena.Api.Controllers
{
  [Authorize]
  [ApiController]
  [Route("api/user")]
  public class UserController : MediatorControllerBase
  {
    public UserController(IMediator mediator)
        : base(mediator)
    {
    }

    [HttpGet]
    public async Task<IActionResult> GetActiveUserAsync()
    {
        return Ok(await Mediator.Send(new GetActiveUserQuery()
        {
            User = User
        }));
    }

    [HttpPut("password")]
    public async Task<IActionResult> ChangePasswordAsync(ChangePasswordAuthorizedCommand model)
    {
      model.UserName = User.Identity.Name;
      await Mediator.Send(model);
      return NoContent();
    }
  }
}